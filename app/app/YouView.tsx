"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  EXPERIENCE_NODE_CATEGORIES,
  EXPERIENCE_CATEGORY_META,
  getExperienceRelationLabel,
  humanizeExperienceSubtype,
} from "../../lib/experienceOntology";
import { formatNodeLabel } from "../../lib/displayText";
import { createConnectionInvite } from "../../lib/base44Connections";
import {
  cacheInviteUrl,
  forgetCachedInviteUrl,
  readCachedInviteUrl,
} from "../../lib/inviteLinkCache";
import { publicInviteUrl } from "../../lib/publicAppUrl";
import {
  type WorldEdge,
  type WorldNode,
  type WorldNodeCategory,
} from "./graphData";
import {
  loadOrbLayout,
  saveOrbLayout,
  type OrbPosition,
} from "./orbLayoutPersistence";
import {
  ORB_BIRTH_DELAY_MS,
  ORB_BIRTH_DURATION_MS,
  ORB_BIRTH_EDGE_END,
  ORB_BIRTH_EDGE_START,
  ORB_BIRTH_INWARD_DISTANCE,
  ORB_BIRTH_LABEL_END,
  ORB_BIRTH_LABEL_START,
  ORB_BIRTH_STAGGER_MS,
  ORB_BIRTH_START_SCALE,
  loadSeenNodeKeys,
  orderUnseenNodeKeys,
  rangeProgress,
  saveSeenNodeKeys,
  strongEaseOut,
  unitProgress,
} from "./orbBirth";
import { categoryOrbGradient } from "./categoryAppearance";
import {
  CURSOR_DAMPING,
  CURSOR_INFLUENCE_PADDING,
  CURSOR_MAX_RADIUS_FRACTION,
  CURSOR_MAX_WORLD_OFFSET,
  LABEL_EMPHASIS_DAMPING,
  cursorVicinityInfluence,
  focusDistance,
  frameDamping,
  heroLabelScale,
} from "./orbMotion";
import { MIN_ORB_RADIUS, SELF_ORB_RADIUS } from "./orbSizing";
import { createWorldOrbMaterial, createWorldOrbTexture } from "./orbMaterial";
import styles from "./YouView.module.css";

const INITIAL_CAMERA_DESKTOP = new THREE.Vector3(0, 0.12, 10.25);
const INITIAL_CAMERA_MOBILE = new THREE.Vector3(0, 0.1, 19);
const CONNECTION_SEGMENTS = 28;
/**
 * What a friend actually reads. It says the true thing — they are already in
 * one of your memories — in the voice of a person sending a text, and never
 * addresses them by a name the sender may have written differently.
 */
const INVITE_MESSAGE =
  "I added a memory with you in it to my world. Let's connect on Chapter.";
const LEGEND_CATEGORY_ORDER: readonly WorldNodeCategory[] = [
  "self",
  ...EXPERIENCE_NODE_CATEGORIES,
];

type RenderedConnection = {
  edge: WorldEdge;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  curve: THREE.QuadraticBezierCurve3;
  point: THREE.Vector3;
  baseOpacity: number;
  selectionOpacity: number;
  totalDrawCount: number;
};

function worldCategoryLabel(node: WorldNode) {
  return worldCategoryName(node.category);
}

function worldCategoryName(category: WorldNodeCategory) {
  return category === "self"
    ? "You"
    : EXPERIENCE_CATEGORY_META[category].label;
}

function connectionOpacity(edge: WorldEdge) {
  if (edge.role === "root") return 0.54;
  return edge.certainty === "fact" ? 0.44 : 0.35;
}

function createConnection(
  from: THREE.Vector3,
  to: THREE.Vector3,
  edge: WorldEdge,
) {
  const midpoint = from.clone().lerp(to, 0.5);
  midpoint.z +=
    (edge.role === "root" ? 0.2 : 0.28) + from.distanceTo(to) * 0.05;
  const curve = new THREE.QuadraticBezierCurve3(from, midpoint, to);
  const geometry = new THREE.BufferGeometry().setFromPoints(
    curve.getPoints(CONNECTION_SEGMENTS),
  );
  const material = new THREE.LineBasicMaterial({
    color:
      edge.role === "root"
        ? 0x6f7070
        : edge.certainty === "fact"
          ? 0x7f7972
          : 0x969088,
    transparent: true,
    opacity: connectionOpacity(edge),
    depthWrite: false,
  });
  return {
    line: new THREE.Line(geometry, material),
    curve,
    point: new THREE.Vector3(),
  };
}

function updateConnectionGeometry(
  connection: RenderedConnection,
  from: THREE.Vector3,
  to: THREE.Vector3,
) {
  connection.curve.v0.copy(from);
  connection.curve.v1.copy(from).lerp(to, 0.5);
  connection.curve.v1.z +=
    (connection.edge.role === "root" ? 0.2 : 0.28) +
    from.distanceTo(to) * 0.05;
  connection.curve.v2.copy(to);

  const positions = connection.line.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  for (let index = 0; index <= CONNECTION_SEGMENTS; index += 1) {
    connection.curve.getPoint(index / CONNECTION_SEGMENTS, connection.point);
    positions.setXYZ(
      index,
      connection.point.x,
      connection.point.y,
      connection.point.z,
    );
  }

  positions.needsUpdate = true;
  connection.line.geometry.computeBoundingSphere();
}

function softenBoundary(value: number, limit: number) {
  const distance = Math.abs(value);
  if (distance <= limit) return value;

  const softenedOvershoot = Math.min(0.72, (distance - limit) * 0.24);
  return Math.sign(value) * (limit + softenedOvershoot);
}

export default function YouView({
  nodes: worldNodes,
  edges: worldEdges,
  onInviteCreated,
}: {
  nodes: readonly WorldNode[];
  edges: readonly WorldEdge[];
  onInviteCreated?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectedKeyRef = useRef<string | null>(null);
  /**
   * The system share sheet is single-flight: asking for a second one while the
   * first is still open rejects the call outright. On desktop the first can sit
   * unsettled for a long time, so a second click is easy to make by accident.
   */
  const sharingRef = useRef(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [inviteState, setInviteState] = useState<{
    nodeId: string;
    status: "creating" | "ready" | "shared" | "error";
    url?: string;
  } | null>(null);
  const worldNodeByKey = useMemo(
    () => new Map(worldNodes.map((node) => [node.key, node])),
    [worldNodes],
  );
  const legendCategories = useMemo(() => {
    const presentCategories = new Set(
      worldNodes.map((node) => node.category),
    );
    return LEGEND_CATEGORY_ORDER.filter((category) =>
      presentCategories.has(category),
    );
  }, [worldNodes]);

  const selectedNode = useMemo(
    () => (selectedKey ? (worldNodeByKey.get(selectedKey) ?? null) : null),
    [selectedKey, worldNodeByKey],
  );
  const connectedItems = useMemo(() => {
    if (!selectedKey) return [];

    const items: Array<{
      node: WorldNode;
      edge: WorldEdge;
      direction: "forward" | "reverse";
    }> = [];

    for (const edge of worldEdges) {
      const direction =
        edge.from === selectedKey
          ? "forward"
          : edge.to === selectedKey
            ? "reverse"
            : null;
      if (!direction) continue;

      const connectedKey = direction === "forward" ? edge.to : edge.from;
      const node = worldNodeByKey.get(connectedKey);
      if (node) items.push({ node, edge, direction });
    }

    return items.sort(
      (first, second) =>
        second.edge.strength - first.edge.strength ||
        first.node.label.localeCompare(second.node.label),
    );
  }, [selectedKey, worldEdges, worldNodeByKey]);

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  // Once someone accepts, their link is spent. Drop it so a stale one is never
  // handed out again from this device.
  useEffect(() => {
    for (const node of worldNodes) {
      if (node.linkedUserId || node.connectionId) {
        forgetCachedInviteUrl(node.key);
      }
    }
  }, [worldNodes]);

  /**
   * Asks the backend for this person's link, showing the one already on this
   * device first. The link is stable, so the remembered one is almost always
   * the answer — and a backend call can take many seconds.
   */
  async function prepareInvite(node: WorldNode) {
    const remembered = readCachedInviteUrl(node.key);
    setInviteState(
      remembered
        ? { nodeId: node.key, status: "ready", url: remembered }
        : { nodeId: node.key, status: "creating" },
    );

    try {
      const invite = await createConnectionInvite(node.key);
      const url = publicInviteUrl(invite.token);
      cacheInviteUrl(node.key, url);
      // Someone who already shared while this was in flight keeps that state.
      setInviteState((current) =>
        current?.nodeId === node.key && current.status === "shared"
          ? { ...current, url }
          : { nodeId: node.key, status: "ready", url },
      );
      onInviteCreated?.();
    } catch (error) {
      console.error("Could not create a Chapter connection invite", error);
      // A remembered link is still worth offering when the backend is unwell.
      if (!remembered) setInviteState({ nodeId: node.key, status: "error" });
    }
  }

  function shareInvite(node: WorldNode, url: string) {
    const markShared = () => {
      setInviteState({ nodeId: node.key, status: "shared", url });
    };

    /** Every path that isn't the share sheet: the link still has to reach them. */
    const copyInvite = () => {
      if (navigator.clipboard) {
        void navigator.clipboard
          .writeText(url)
          .then(markShared)
          .catch((error) => {
            console.error("Could not copy the invite", error);
            setInviteState({ nodeId: node.key, status: "error", url });
          });
        return;
      }

      window.prompt("Copy this private Chapter invite", url);
      markShared();
    };

    // A sheet is already open. The click that got here is a double-tap on a
    // modal dialog, and the right answer is to do nothing.
    if (sharingRef.current) return;

    if (navigator.share) {
      sharingRef.current = true;
      void navigator
        .share({
          title: "Join me on Chapter",
          text: INVITE_MESSAGE,
          url,
        })
        .then(markShared)
        .catch((error: unknown) => {
          // Dismissing the sheet is an answer, not a failure. So is a race we
          // already lost — a share is open somewhere and will settle on its own.
          const errorName = error instanceof DOMException ? error.name : "";
          if (errorName === "AbortError" || errorName === "InvalidStateError") {
            return;
          }
          console.error("Could not open the share sheet", error);
          copyInvite();
        })
        .finally(() => {
          sharingRef.current = false;
        });
      return;
    }

    copyInvite();
  }

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedKey(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const containerElement: HTMLDivElement = container;
    const canvasElement: HTMLCanvasElement = canvas;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasElement,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      containerElement.dataset.webglFailed = "true";
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0xffffff, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const initialCamera =
      window.innerWidth < 640
        ? INITIAL_CAMERA_MOBILE
        : INITIAL_CAMERA_DESKTOP;
    camera.position.copy(initialCamera);

    const controls = new OrbitControls(camera, canvasElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.65;
    controls.panSpeed = 0.5;
    controls.minDistance = 2.6;
    controls.maxDistance = 24;
    controls.screenSpacePanning = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.touches.ONE = THREE.TOUCH.PAN;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    controls.target.set(0, 0, 0);
    controls.update();

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb6aa9d, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
    keyLight.position.set(-4, 6, 7);
    scene.add(keyLight);
    const warmLight = new THREE.PointLight(0xffc7a2, 12, 18, 2);
    warmLight.position.set(4, -2, 5);
    scene.add(warmLight);
    const coolLight = new THREE.PointLight(0xb7e7f4, 8, 16, 2);
    coolLight.position.set(-5, 1, 3);
    scene.add(coolLight);

    const world = new THREE.Group();
    world.rotation.set(-0.08, -0.22, 0.025);
    world.position.y = 0.24;
    scene.add(world);

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointerQuery = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    );
    let reducedMotion = motionQuery.matches;
    let hasFinePointer = finePointerQuery.matches;
    let layoutStorage: Storage | null = null;
    try {
      layoutStorage = window.localStorage;
    } catch {
      // Browsers may disable storage. The world still works with authored
      // positions for that session.
    }
    const allowedNodeKeys = new Set(worldNodes.map((node) => node.key));
    const savedPositions = loadOrbLayout(
      layoutStorage,
      allowedNodeKeys,
    );
    const seenNodeKeys = loadSeenNodeKeys(layoutStorage, allowedNodeKeys);
    seenNodeKeys.add("self");
    const unseenNodeKeys = orderUnseenNodeKeys(
      worldNodes,
      worldEdges,
      seenNodeKeys,
    );
    const unseenNodeKeySet = new Set(unseenNodeKeys);
    const birthStartDelays = new Map(
      unseenNodeKeys.map((key, index) => [
        key,
        ORB_BIRTH_DELAY_MS + index * ORB_BIRTH_STAGGER_MS,
      ]),
    );
    const rawBirthProgress = new Map<string, number>();
    const easedBirthProgress = new Map<string, number>();
    for (const node of worldNodes) {
      const progress =
        reducedMotion || node.key === "self" || !unseenNodeKeySet.has(node.key)
          ? 1
          : 0;
      rawBirthProgress.set(node.key, progress);
      easedBirthProgress.set(node.key, progress);
    }
    if (reducedMotion) {
      for (const node of worldNodes) seenNodeKeys.add(node.key);
      saveSeenNodeKeys(layoutStorage, seenNodeKeys);
    }

    const meshes = new Map<
      string,
      THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial>
    >();
    const textures: THREE.Texture[] = [];
    const baseOpacities = new Map<string, number>();
    const selectionOpacities = new Map<string, number>();
    const interactionScales = new Map<string, number>();
    const restPositions = new Map<string, THREE.Vector3>();
    const cursorOffsets = new Map<string, THREE.Vector3>();
    const birthInwardOffsets = new Map<string, THREE.Vector3>();
    const haloMaterials = new Map<
      string,
      { material: THREE.MeshBasicMaterial; baseOpacity: number }
    >();
    const labelEmphasis = new Map<string, number>();

    for (const node of worldNodes) {
      const texture = createWorldOrbTexture(node);
      if (texture) textures.push(texture);
      const geometry = new THREE.SphereGeometry(node.radius, 52, 38);
      const baseOpacity = node.certainty === "hypothesis" ? 0.88 : 1;
      const material = createWorldOrbMaterial(node, texture);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...(savedPositions.get(node.key) ?? node.position));
      const initialBirthProgress = easedBirthProgress.get(node.key) ?? 1;
      mesh.scale.setScalar(
        ORB_BIRTH_START_SCALE +
          (1 - ORB_BIRTH_START_SCALE) * initialBirthProgress,
      );
      mesh.material.opacity = baseOpacity * initialBirthProgress;
      mesh.material.depthWrite = initialBirthProgress >= 1;
      mesh.visible = initialBirthProgress > 0;
      mesh.userData.nodeKey = node.key;
      world.add(mesh);
      meshes.set(node.key, mesh);
      baseOpacities.set(node.key, baseOpacity);
      selectionOpacities.set(node.key, baseOpacity);
      interactionScales.set(node.key, 1);
      restPositions.set(node.key, mesh.position.clone());
      cursorOffsets.set(node.key, new THREE.Vector3());
      labelEmphasis.set(node.key, 0);

      if (node.category === "self" || node.category === "experience") {
        const haloBaseOpacity = node.category === "self" ? 0.11 : 0.055;
        const haloMaterial = new THREE.MeshBasicMaterial({
          color: node.category === "self" ? 0xb8cbd3 : 0xd79a72,
          transparent: true,
          opacity: haloBaseOpacity * initialBirthProgress,
          side: THREE.BackSide,
          depthWrite: false,
        });
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(
            node.radius * (node.category === "self" ? 1.2 : 1.14),
            40,
            28,
          ),
          haloMaterial,
        );
        mesh.add(halo);
        haloMaterials.set(node.key, {
          material: haloMaterial,
          baseOpacity: haloBaseOpacity,
        });
      }
    }

    // The drag boundary follows the graph's actual extent (plus breathing
    // room) instead of a fixed box, so orbs on far-out branches remain fully
    // draggable while still keeping the world visually contained.
    const dragBoundary = new THREE.Vector3(5.2, 3.8, 2.8);
    for (const restPosition of restPositions.values()) {
      dragBoundary.x = Math.min(
        28,
        Math.max(dragBoundary.x, Math.abs(restPosition.x) + 2.6),
      );
      dragBoundary.y = Math.min(
        28,
        Math.max(dragBoundary.y, Math.abs(restPosition.y) + 2.6),
      );
      dragBoundary.z = Math.min(
        28,
        Math.max(dragBoundary.z, Math.abs(restPosition.z) + 1.4),
      );
    }

    const centreRestPosition = restPositions.get("self");
    for (const node of worldNodes) {
      const restPosition = restPositions.get(node.key);
      const inwardOffset = new THREE.Vector3();
      if (
        unseenNodeKeySet.has(node.key) &&
        restPosition &&
        centreRestPosition
      ) {
        inwardOffset
          .copy(centreRestPosition)
          .sub(restPosition)
          .setZ(0);
        if (inwardOffset.lengthSq() > 0) {
          inwardOffset.normalize().multiplyScalar(ORB_BIRTH_INWARD_DISTANCE);
        }
        meshes
          .get(node.key)
          ?.position.addScaledVector(
            inwardOffset,
            1 - (easedBirthProgress.get(node.key) ?? 1),
          );
      }
      birthInwardOffsets.set(node.key, inwardOffset);
    }

    const edgeLines: RenderedConnection[] = [];

    for (const edge of worldEdges) {
      const from = meshes.get(edge.from);
      const to = meshes.get(edge.to);
      if (!from || !to) continue;
      const connection = createConnection(
        from.position.clone(),
        to.position.clone(),
        edge,
      );
      world.add(connection.line);
      edgeLines.push({
        edge,
        ...connection,
        baseOpacity: connectionOpacity(edge),
        selectionOpacity: connectionOpacity(edge),
        totalDrawCount:
          connection.line.geometry.getAttribute("position").count,
      });
      const endpointProgress = Math.min(
        rawBirthProgress.get(edge.from) ?? 1,
        rawBirthProgress.get(edge.to) ?? 1,
      );
      const edgeProgress = rangeProgress(
        endpointProgress,
        ORB_BIRTH_EDGE_START,
        ORB_BIRTH_EDGE_END,
      );
      const totalDrawCount =
        connection.line.geometry.getAttribute("position").count;
      connection.line.geometry.setDrawRange(
        0,
        edgeProgress <= 0
          ? 0
          : Math.min(
              totalDrawCount,
              Math.max(2, Math.ceil(totalDrawCount * edgeProgress)),
            ),
      );
      connection.line.material.opacity =
        connectionOpacity(edge) * edgeProgress;
    }

    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const pointerStart = new THREE.Vector2();
    const pointerCurrent = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const dragPlaneNormal = new THREE.Vector3();
    const dragIntersection = new THREE.Vector3();
    const draggedWorldPosition = new THREE.Vector3();
    const dragOffset = new THREE.Vector3();
    const panRight = new THREE.Vector3();
    const panUp = new THREE.Vector3();
    const panOffset = new THREE.Vector3();
    const pointerCanvasPosition = new THREE.Vector2();
    const clock = new THREE.Clock();
    const birthEpochMs = window.performance.now();
    const focusWorldPosition = new THREE.Vector3();
    const focusViewDirection = new THREE.Vector3();
    const cameraDestination = new THREE.Vector3();
    const targetDestination = new THREE.Vector3();
    let cameraBookmark: {
      position: THREE.Vector3;
      target: THREE.Vector3;
    } | null = null;
    let cameraFlightMode: "focus" | "restore" | null = null;
    let hasCameraDestination = false;
    let lastFocusKey: string | null = null;
    let restorationPending = false;
    let hoveredKey: string | null = null;
    let dragCandidateKey: string | null = null;
    let draggingKey: string | null = null;
    let activePointerId: number | null = null;
    let animationFrame = 0;
    let pointerInsideCanvas = false;

    function isCameraFlightActive() {
      return hasCameraDestination;
    }

    function completeCameraFlight() {
      if (!hasCameraDestination) return;

      camera.position.copy(cameraDestination);
      controls.target.copy(targetDestination);
      camera.updateMatrixWorld();
      controls.update();
      camera.position.copy(cameraDestination);
      controls.target.copy(targetDestination);
      camera.updateMatrixWorld();

      if (cameraFlightMode === "restore") {
        cameraBookmark = null;
      }
      hasCameraDestination = false;
      cameraFlightMode = null;
      controls.enabled = activePointerId === null;
    }

    function cancelCameraFlight() {
      if (!hasCameraDestination) return;

      const wasRestoring = cameraFlightMode === "restore";
      hasCameraDestination = false;
      cameraFlightMode = null;
      restorationPending = false;
      if (wasRestoring && selectedKeyRef.current === null) {
        cameraBookmark = null;
      }
      controls.enabled = activePointerId === null;
    }

    function resetCursorOffset(nodeKey: string) {
      const mesh = meshes.get(nodeKey);
      const restPosition = restPositions.get(nodeKey);
      const offset = cursorOffsets.get(nodeKey);
      if (!mesh || !restPosition || !offset || offset.lengthSq() === 0) return;

      offset.set(0, 0, 0);
      mesh.position.copy(restPosition);
      updateConnectedLines(nodeKey);
    }

    function completeAllOrbBirths() {
      let identitiesChanged = false;
      for (const node of worldNodes) {
        rawBirthProgress.set(node.key, 1);
        easedBirthProgress.set(node.key, 1);
        if (!seenNodeKeys.has(node.key)) {
          seenNodeKeys.add(node.key);
          identitiesChanged = true;
        }
      }
      if (identitiesChanged) saveSeenNodeKeys(layoutStorage, seenNodeKeys);
    }

    function requestCameraFocus(nodeKey: string) {
      const mesh = meshes.get(nodeKey);
      const node = worldNodeByKey.get(nodeKey);
      if (!mesh || !node) return;

      resetCursorOffset(nodeKey);
      mesh.getWorldPosition(focusWorldPosition);
      focusViewDirection
        .copy(camera.position)
        .sub(controls.target)
        .normalize();
      if (focusViewDirection.lengthSq() === 0) {
        camera.getWorldDirection(focusViewDirection).multiplyScalar(-1);
      }

      targetDestination.copy(focusWorldPosition);
      cameraDestination
        .copy(focusWorldPosition)
        .addScaledVector(focusViewDirection, focusDistance(node.radius));
      cameraFlightMode = "focus";
      hasCameraDestination = true;
      restorationPending = false;
      controls.enabled = false;
    }

    function requestCameraRestore() {
      if (!cameraBookmark) return;

      cameraDestination.copy(cameraBookmark.position);
      targetDestination.copy(cameraBookmark.target);
      cameraFlightMode = "restore";
      hasCameraDestination = true;
      restorationPending = false;
      controls.enabled = false;
    }

    function syncCameraSelection() {
      const selected = selectedKeyRef.current;
      if (selected !== lastFocusKey) {
        if (selected) {
          if (!cameraBookmark) {
            cameraBookmark = {
              position: camera.position.clone(),
              target: controls.target.clone(),
            };
          }
          requestCameraFocus(selected);
        } else if (cameraBookmark) {
          restorationPending = true;
          if (!draggingKey) requestCameraRestore();
        }
        lastFocusKey = selected;
      }

      if (
        restorationPending &&
        !selected &&
        !draggingKey &&
        !hasCameraDestination
      ) {
        requestCameraRestore();
      }
    }

    function updatePointerCanvasPosition(event: PointerEvent) {
      const rect = canvasElement.getBoundingClientRect();
      pointerCanvasPosition.set(
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
      pointerInsideCanvas = true;
    }

    function updatePointer(event: PointerEvent) {
      const rect = canvasElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    }

    function pickNode(event: PointerEvent) {
      updatePointer(event);
      const hits = raycaster.intersectObjects([...meshes.values()], false);
      for (const hit of hits) {
        const nodeKey = hit.object.userData.nodeKey as string | undefined;
        if ((rawBirthProgress.get(nodeKey ?? "") ?? 1) >= 0.9) {
          return nodeKey;
        }
      }
      return undefined;
    }

    function updateConnectedLines(nodeKey: string) {
      for (const connection of edgeLines) {
        if (
          connection.edge.from !== nodeKey &&
          connection.edge.to !== nodeKey
        ) {
          continue;
        }

        const from = meshes.get(connection.edge.from);
        const to = meshes.get(connection.edge.to);
        if (!from || !to) continue;
        updateConnectionGeometry(connection, from.position, to.position);
      }
    }

    function persistOrbPositions() {
      const positions = new Map<string, OrbPosition>();
      for (const [key, restPosition] of restPositions) {
        positions.set(key, [
          restPosition.x,
          restPosition.y,
          restPosition.z,
        ]);
      }
      saveOrbLayout(layoutStorage, positions);
    }

    function onPointerMove(event: PointerEvent) {
      updatePointerCanvasPosition(event);
      if (
        activePointerId !== null &&
        event.pointerId !== activePointerId
      ) {
        return;
      }

      if (dragCandidateKey) {
        event.preventDefault();
        event.stopImmediatePropagation();

        pointerCurrent.set(event.clientX, event.clientY);
        const movement = pointerStart.distanceTo(pointerCurrent);

        if (!draggingKey && movement > 4) {
          draggingKey = dragCandidateKey;
          cancelCameraFlight();
          selectedKeyRef.current = null;
          setSelectedKey(null);
        }

        if (draggingKey) {
          const mesh = meshes.get(draggingKey);
          const restPosition = restPositions.get(draggingKey);
          const cursorOffset = cursorOffsets.get(draggingKey);
          updatePointer(event);

          if (
            mesh &&
            restPosition &&
            cursorOffset &&
            raycaster.ray.intersectPlane(dragPlane, dragIntersection)
          ) {
            draggedWorldPosition.copy(dragIntersection).add(dragOffset);
            world.worldToLocal(draggedWorldPosition);
            draggedWorldPosition.set(
              softenBoundary(draggedWorldPosition.x, dragBoundary.x),
              softenBoundary(draggedWorldPosition.y, dragBoundary.y),
              softenBoundary(draggedWorldPosition.z, dragBoundary.z),
            );
            restPosition.copy(draggedWorldPosition);
            cursorOffset.set(0, 0, 0);
            mesh.position.copy(restPosition);
            updateConnectedLines(draggingKey);
          }

          hoveredKey = draggingKey;
          canvasElement.style.cursor = "grabbing";
        }
        return;
      }

      const nextHovered = pickNode(event) ?? null;
      if (nextHovered !== hoveredKey) {
        hoveredKey = nextHovered;
        canvasElement.style.cursor = hoveredKey ? "move" : "grab";
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (activePointerId !== null) return;

      updatePointerCanvasPosition(event);
      pointerStart.set(event.clientX, event.clientY);
      canvasElement.style.cursor = "grabbing";

      const isWorldGesture =
        event.button !== 0 ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey;
      const nodeKey = isWorldGesture ? null : (pickNode(event) ?? null);
      if (!nodeKey) {
        cancelCameraFlight();
        return;
      }

      const mesh = meshes.get(nodeKey);
      if (!mesh) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      resetCursorOffset(nodeKey);
      activePointerId = event.pointerId;
      dragCandidateKey = nodeKey;
      controls.enabled = false;
      canvasElement.setPointerCapture(event.pointerId);

      mesh.getWorldPosition(draggedWorldPosition);
      camera.getWorldDirection(dragPlaneNormal);
      dragPlane.setFromNormalAndCoplanarPoint(
        dragPlaneNormal,
        draggedWorldPosition,
      );
      updatePointer(event);
      if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
        dragOffset.copy(draggedWorldPosition).sub(dragIntersection);
      } else {
        dragOffset.set(0, 0, 0);
      }
    }

    function onPointerUp(event: PointerEvent) {
      if (
        activePointerId !== null &&
        event.pointerId !== activePointerId
      ) {
        return;
      }

      pointerCurrent.set(event.clientX, event.clientY);
      const movement = pointerStart.distanceTo(pointerCurrent);

      if (dragCandidateKey) {
        event.preventDefault();
        event.stopImmediatePropagation();

        const movedOrb = draggingKey !== null;

        if (!draggingKey && movement <= 5) {
          selectedKeyRef.current = dragCandidateKey;
          setSelectedKey(dragCandidateKey);
        }

        if (canvasElement.hasPointerCapture(event.pointerId)) {
          canvasElement.releasePointerCapture(event.pointerId);
        }

        activePointerId = null;
        dragCandidateKey = null;
        draggingKey = null;
        controls.enabled = !hasCameraDestination;
        if (movedOrb) persistOrbPositions();
        hoveredKey = pickNode(event) ?? null;
        canvasElement.style.cursor = hoveredKey ? "move" : "grab";
        return;
      }

      canvasElement.style.cursor = hoveredKey ? "move" : "grab";
      if (movement <= 5) setSelectedKey(null);
    }

    function onPointerCancel(event: PointerEvent) {
      if (event.pointerId !== activePointerId) return;
      const movedOrb = draggingKey !== null;
      if (canvasElement.hasPointerCapture(event.pointerId)) {
        canvasElement.releasePointerCapture(event.pointerId);
      }
      activePointerId = null;
      dragCandidateKey = null;
      draggingKey = null;
      controls.enabled = !hasCameraDestination;
      if (movedOrb) persistOrbPositions();
      canvasElement.style.cursor = "grab";
    }

    function onWheel(event: WheelEvent) {
      cancelCameraFlight();

      // Browsers expose a trackpad pinch as a wheel event with ctrlKey set.
      // Leave those events to OrbitControls; ordinary two-finger movement pans.
      if (event.ctrlKey) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const deltaMultiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? containerElement.clientHeight
            : 1;
      const distance = camera.position.distanceTo(controls.target);
      const worldUnitsPerPixel =
        (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))) /
        Math.max(containerElement.clientHeight, 1);

      camera.updateMatrixWorld();
      panRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      panUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      panOffset
        .copy(panRight)
        .multiplyScalar(event.deltaX * deltaMultiplier * worldUnitsPerPixel)
        .addScaledVector(
          panUp,
          -event.deltaY * deltaMultiplier * worldUnitsPerPixel,
        );

      camera.position.add(panOffset);
      controls.target.add(panOffset);
      controls.update();
    }

    function onContextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    function onPointerLeave() {
      pointerInsideCanvas = false;
      if (activePointerId !== null) return;
      hoveredKey = null;
      canvasElement.style.cursor = "grab";
    }

    function onPointerEnter(event: PointerEvent) {
      updatePointerCanvasPosition(event);
    }

    const onMotionPreference = () => {
      reducedMotion = motionQuery.matches;
      controls.enableDamping = !reducedMotion;
      if (reducedMotion) {
        completeAllOrbBirths();
        for (const node of worldNodes) resetCursorOffset(node.key);
        completeCameraFlight();
      }
    };
    const onFinePointerPreference = () => {
      hasFinePointer = finePointerQuery.matches;
    };
    motionQuery.addEventListener("change", onMotionPreference);
    finePointerQuery.addEventListener("change", onFinePointerPreference);
    onMotionPreference();
    onFinePointerPreference();

    canvasElement.addEventListener("pointerenter", onPointerEnter);
    canvasElement.addEventListener("pointermove", onPointerMove, true);
    canvasElement.addEventListener("pointerdown", onPointerDown, true);
    canvasElement.addEventListener("pointerup", onPointerUp, true);
    canvasElement.addEventListener("pointercancel", onPointerCancel, true);
    canvasElement.addEventListener("pointerleave", onPointerLeave);
    canvasElement.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });
    canvasElement.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("pagehide", persistOrbPositions);

    const worldPosition = new THREE.Vector3();
    const labelPosition = new THREE.Vector3();
    const viewPosition = new THREE.Vector3();
    const scaleVector = new THREE.Vector3();
    const cursorWorldPosition = new THREE.Vector3();
    const cursorProjectedPosition = new THREE.Vector3();
    const cursorViewPosition = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    const cursorAwayWorld = new THREE.Vector3();
    const cursorAwayLocal = new THREE.Vector3();
    const cursorTargetOffset = new THREE.Vector3();
    const zeroCursorOffset = new THREE.Vector3();
    const previousCursorOffset = new THREE.Vector3();
    const previousBirthPosition = new THREE.Vector3();
    const nextMeshPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const inverseWorldQuaternion = new THREE.Quaternion();
    const connectedKeys = new Set<string>();
    const verticalProjectionScale =
      1 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));

    function resize() {
      const { width, height } = containerElement.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    function applyCursorInfluence(deltaSeconds: number) {
      const eligible =
        hasFinePointer &&
        pointerInsideCanvas &&
        selectedKeyRef.current === null &&
        draggingKey === null &&
        !isCameraFlightActive() &&
        !reducedMotion;
      let influencedKey: string | null = null;
      let highestInfluence = 0;
      let closestSurfaceDistance = Number.POSITIVE_INFINITY;
      let influencedScreenDeltaX = 0;
      let influencedScreenDeltaY = 0;

      if (eligible) {
        for (const node of worldNodes) {
          if ((rawBirthProgress.get(node.key) ?? 1) < 1) continue;
          const mesh = meshes.get(node.key);
          if (!mesh) continue;

          mesh.getWorldPosition(cursorWorldPosition);
          cursorProjectedPosition.copy(cursorWorldPosition).project(camera);
          cursorViewPosition
            .copy(cursorWorldPosition)
            .applyMatrix4(camera.matrixWorldInverse);
          const depth = -cursorViewPosition.z;
          if (cursorProjectedPosition.z > 1 || depth <= 0) continue;

          const centerX =
            (cursorProjectedPosition.x * 0.5 + 0.5) *
            containerElement.clientWidth;
          const centerY =
            (-cursorProjectedPosition.y * 0.5 + 0.5) *
            containerElement.clientHeight;
          const screenDeltaX = pointerCanvasPosition.x - centerX;
          const screenDeltaY = pointerCanvasPosition.y - centerY;
          const distance = Math.hypot(screenDeltaX, screenDeltaY);
          const projectedRadius =
            node.radius *
            mesh.scale.x *
            containerElement.clientHeight *
            verticalProjectionScale /
            depth;
          if (distance > projectedRadius + CURSOR_INFLUENCE_PADDING) continue;

          const influence = cursorVicinityInfluence(
            distance,
            projectedRadius,
          );
          if (influence <= 0) continue;

          const surfaceDistance = Math.abs(distance - projectedRadius);
          if (
            influence > highestInfluence ||
            (influence === highestInfluence &&
              surfaceDistance < closestSurfaceDistance)
          ) {
            influencedKey = node.key;
            highestInfluence = influence;
            closestSurfaceDistance = surfaceDistance;
            influencedScreenDeltaX = screenDeltaX;
            influencedScreenDeltaY = screenDeltaY;
          }
        }
      }

      cursorTargetOffset.set(0, 0, 0);
      if (influencedKey) {
        cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        cameraUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
        cursorAwayWorld
          .copy(cameraRight)
          .multiplyScalar(-influencedScreenDeltaX)
          .addScaledVector(cameraUp, influencedScreenDeltaY);

        if (cursorAwayWorld.lengthSq() > 0.000001) {
          world.getWorldQuaternion(worldQuaternion);
          inverseWorldQuaternion.copy(worldQuaternion).invert();
          cursorAwayLocal
            .copy(cursorAwayWorld)
            .normalize()
            .applyQuaternion(inverseWorldQuaternion);
          const node = worldNodeByKey.get(influencedKey);
          if (node) {
            const maximumOffset = Math.min(
              node.radius * CURSOR_MAX_RADIUS_FRACTION,
              CURSOR_MAX_WORLD_OFFSET,
            );
            cursorTargetOffset
              .copy(cursorAwayLocal)
              .multiplyScalar(highestInfluence * maximumOffset);
          }
        }
      }

      const alpha = frameDamping(deltaSeconds, CURSOR_DAMPING);
      for (const node of worldNodes) {
        const mesh = meshes.get(node.key);
        const restPosition = restPositions.get(node.key);
        const offset = cursorOffsets.get(node.key);
        if (!mesh || !restPosition || !offset) continue;

        previousCursorOffset.copy(offset);
        if (reducedMotion) {
          offset.set(0, 0, 0);
        } else {
          offset.lerp(
            node.key === influencedKey
              ? cursorTargetOffset
              : zeroCursorOffset,
            alpha,
          );
        }
        nextMeshPosition.copy(restPosition).add(offset);
        mesh.position.copy(nextMeshPosition);

        if (previousCursorOffset.distanceTo(offset) > 0.0001) {
          updateConnectedLines(node.key);
        }
      }
    }

    function applyOrbBirthMotion(elapsedMs: number) {
      let identitiesChanged = false;

      for (const nodeKey of unseenNodeKeys) {
        const mesh = meshes.get(nodeKey);
        const restPosition = restPositions.get(nodeKey);
        const cursorOffset = cursorOffsets.get(nodeKey);
        const inwardOffset = birthInwardOffsets.get(nodeKey);
        if (!mesh || !restPosition || !cursorOffset || !inwardOffset) continue;

        const rawProgress = reducedMotion || seenNodeKeys.has(nodeKey)
          ? 1
          : unitProgress(
              elapsedMs,
              birthStartDelays.get(nodeKey) ?? ORB_BIRTH_DELAY_MS,
              ORB_BIRTH_DURATION_MS,
            );
        const easedProgress = reducedMotion
          ? 1
          : strongEaseOut(rawProgress);
        rawBirthProgress.set(nodeKey, rawProgress);
        easedBirthProgress.set(nodeKey, easedProgress);

        previousBirthPosition.copy(mesh.position);
        nextMeshPosition
          .copy(restPosition)
          .add(cursorOffset)
          .addScaledVector(inwardOffset, 1 - easedProgress);
        mesh.position.copy(nextMeshPosition);
        if (previousBirthPosition.distanceTo(mesh.position) > 0.0001) {
          updateConnectedLines(nodeKey);
        }

        if (rawProgress >= 1 && !seenNodeKeys.has(nodeKey)) {
          seenNodeKeys.add(nodeKey);
          identitiesChanged = true;
        }
      }

      if (identitiesChanged) saveSeenNodeKeys(layoutStorage, seenNodeKeys);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(containerElement);
    resize();

    function render() {
      animationFrame = window.requestAnimationFrame(render);
      const deltaSeconds = clock.getDelta();
      syncCameraSelection();

      if (hasCameraDestination) {
        controls.enabled = false;
        if (reducedMotion) {
          completeCameraFlight();
        } else {
          const alpha = frameDamping(deltaSeconds);
          camera.position.lerp(cameraDestination, alpha);
          controls.target.lerp(targetDestination, alpha);
          controls.update();

          if (
            camera.position.distanceTo(cameraDestination) <= 0.005 &&
            controls.target.distanceTo(targetDestination) <= 0.003
          ) {
            completeCameraFlight();
          }
        }
      } else if (!reducedMotion) {
        controls.update();
      }
      camera.updateMatrixWorld();
      applyCursorInfluence(deltaSeconds);
      applyOrbBirthMotion(window.performance.now() - birthEpochMs);

      const selected = selectedKeyRef.current;
      connectedKeys.clear();
      if (selected) {
        connectedKeys.add(selected);
        connectedKeys.add("self");
        for (const edge of worldEdges) {
          if (edge.from === selected) connectedKeys.add(edge.to);
          if (edge.to === selected) connectedKeys.add(edge.from);
        }
      }

      for (const node of worldNodes) {
        const mesh = meshes.get(node.key);
        if (!mesh) continue;
        const isSelected = selected === node.key;
        const isHovered = hoveredKey === node.key;
        const isDragging = draggingKey === node.key;
        const interactionScale = isDragging
          ? 1.14
          : isSelected
            ? 1.12
            : isHovered
              ? 1.07
              : 1;
        const birthProgress = easedBirthProgress.get(node.key) ?? 1;
        const birthScale =
          ORB_BIRTH_START_SCALE +
          (1 - ORB_BIRTH_START_SCALE) * birthProgress;
        const currentInteractionScale =
          interactionScales.get(node.key) ?? 1;
        const nextInteractionScale = THREE.MathUtils.lerp(
          currentInteractionScale,
          interactionScale,
          reducedMotion ? 1 : 0.13,
        );
        interactionScales.set(node.key, nextInteractionScale);
        scaleVector.setScalar(nextInteractionScale * birthScale);
        mesh.scale.copy(scaleVector);

        const baseOpacity = baseOpacities.get(node.key) ?? 1;
        const selectionAwareOpacity =
          !selected || connectedKeys.has(node.key) ? baseOpacity : 0.26;
        const currentSelectionOpacity =
          selectionOpacities.get(node.key) ?? baseOpacity;
        const nextSelectionOpacity = THREE.MathUtils.lerp(
          currentSelectionOpacity,
          selectionAwareOpacity,
          reducedMotion ? 1 : 0.12,
        );
        selectionOpacities.set(node.key, nextSelectionOpacity);
        mesh.material.opacity = nextSelectionOpacity * birthProgress;
        mesh.material.depthWrite = birthProgress >= 1;
        mesh.visible = birthProgress > 0;
        const halo = haloMaterials.get(node.key);
        if (halo) {
          halo.material.opacity = halo.baseOpacity * birthProgress;
        }

        const label = labelRefs.current.get(node.key);
        if (!label) continue;
        mesh.getWorldPosition(worldPosition);
        labelPosition.copy(worldPosition);
        labelPosition.project(camera);
        viewPosition.copy(worldPosition).applyMatrix4(camera.matrixWorldInverse);
        const depth = -viewPosition.z;
        const isBehind = labelPosition.z > 1 || depth <= 0;
        const x =
          (labelPosition.x * 0.5 + 0.5) * containerElement.clientWidth;
        const orbCenterY =
          (-labelPosition.y * 0.5 + 0.5) * containerElement.clientHeight;
        const distance = camera.position.distanceTo(worldPosition);
        const distanceScale = THREE.MathUtils.clamp(
          9.5 / distance,
          0.72,
          1.08,
        );
        const orbScale = THREE.MathUtils.clamp(
          THREE.MathUtils.mapLinear(
            node.radius,
            MIN_ORB_RADIUS,
            SELF_ORB_RADIUS,
            0.82,
            1.22,
          ),
          0.82,
          1.22,
        );
        const baseLabelScale = THREE.MathUtils.clamp(
          distanceScale * orbScale,
          0.72,
          1.28,
        );
        const targetLabelEmphasis = isSelected ? 1 : 0;
        const currentLabelEmphasis = labelEmphasis.get(node.key) ?? 0;
        const nextLabelEmphasis = reducedMotion
          ? targetLabelEmphasis
          : THREE.MathUtils.lerp(
              currentLabelEmphasis,
              targetLabelEmphasis,
              frameDamping(deltaSeconds, LABEL_EMPHASIS_DAMPING),
            );
        labelEmphasis.set(node.key, nextLabelEmphasis);
        const labelScale = heroLabelScale(
          baseLabelScale,
          node.category === "self",
          nextLabelEmphasis,
        );
        const projectedRadius =
          depth > 0
            ? node.radius *
              mesh.scale.x *
              containerElement.clientHeight *
              verticalProjectionScale /
              depth
            : 0;
        // Labels can wrap onto multiple rows, so their real height decides
        // how far below the orb they sit.
        const labelHalfHeight =
          label.offsetHeight > 0
            ? label.offsetHeight / 2
            : node.category === "self"
              ? 15.5
              : 13.5;
        const y =
          orbCenterY + projectedRadius + labelHalfHeight * labelScale + 6;
        const hideMinorOnMobile =
          containerElement.clientWidth < 620 && !node.major && !isSelected;
        const isMobile = containerElement.clientWidth < 620;
        const horizontalMargin = isMobile ? 68 : 92;
        const outsideSafeFrame =
          x < horizontalMargin ||
          x > containerElement.clientWidth - horizontalMargin ||
          y < 48 ||
          y > containerElement.clientHeight - (isMobile ? 104 : 72);
        const intendedLabelOpacity =
          isBehind || hideMinorOnMobile || outsideSafeFrame
            ? 0
            : !selected || connectedKeys.has(node.key)
              ? node.certainty === "hypothesis"
                ? 0.76
                : 0.9
              : 0.18;
        const labelBirthProgress = rangeProgress(
          birthProgress,
          ORB_BIRTH_LABEL_START,
          ORB_BIRTH_LABEL_END,
        );
        const labelOpacity = intendedLabelOpacity * labelBirthProgress;
        label.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${labelScale})`;
        label.style.opacity = String(labelOpacity);
        label.tabIndex = (rawBirthProgress.get(node.key) ?? 1) >= 0.9 ? 0 : -1;
        label.style.pointerEvents =
          labelOpacity > 0.4 && (rawBirthProgress.get(node.key) ?? 1) >= 0.9
            ? "auto"
            : "none";
      }

      for (const connection of edgeLines) {
        const { edge, line, baseOpacity, totalDrawCount } = connection;
        const touchesSelection =
          !selected || edge.from === selected || edge.to === selected;
        const selectionAwareOpacity = touchesSelection ? baseOpacity : 0.035;
        const endpointProgress = Math.min(
          rawBirthProgress.get(edge.from) ?? 1,
          rawBirthProgress.get(edge.to) ?? 1,
        );
        const edgeProgress = rangeProgress(
          endpointProgress,
          ORB_BIRTH_EDGE_START,
          ORB_BIRTH_EDGE_END,
        );
        line.geometry.setDrawRange(
          0,
          edgeProgress <= 0
            ? 0
            : Math.min(
                totalDrawCount,
                Math.max(2, Math.ceil(totalDrawCount * edgeProgress)),
              ),
        );
        connection.selectionOpacity = THREE.MathUtils.lerp(
          connection.selectionOpacity,
          selectionAwareOpacity,
          reducedMotion ? 1 : 0.12,
        );
        line.material.opacity = connection.selectionOpacity * edgeProgress;
      }

      renderer.render(scene, camera);
    }
    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      motionQuery.removeEventListener("change", onMotionPreference);
      finePointerQuery.removeEventListener(
        "change",
        onFinePointerPreference,
      );
      canvasElement.removeEventListener("pointerenter", onPointerEnter);
      canvasElement.removeEventListener("pointermove", onPointerMove, true);
      canvasElement.removeEventListener("pointerdown", onPointerDown, true);
      canvasElement.removeEventListener("pointerup", onPointerUp, true);
      canvasElement.removeEventListener("pointercancel", onPointerCancel, true);
      canvasElement.removeEventListener("pointerleave", onPointerLeave);
      canvasElement.removeEventListener("wheel", onWheel, true);
      canvasElement.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pagehide", persistOrbPositions);
      controls.dispose();
      for (const mesh of meshes.values()) {
        for (const child of mesh.children) {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              for (const material of child.material) material.dispose();
            } else {
              child.material.dispose();
            }
          }
        }
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      for (const { line } of edgeLines) {
        line.geometry.dispose();
        line.material.dispose();
      }
      for (const texture of textures) texture.dispose();
      renderer.dispose();
    };
  }, [worldEdges, worldNodeByKey, worldNodes]);

  return (
    <div className={styles.world} ref={containerRef}>
      <div className={styles.atmosphere} aria-hidden="true" />
      <canvas
        className={styles.canvas}
        ref={canvasRef}
        aria-label="An interactive three-dimensional map of your memories"
      />

      <aside
        className={styles.legend}
        aria-label="Orb legend"
      >
        <h2>Legend</h2>
        <ul className={styles.legendList}>
          {legendCategories.map((category) => (
            <li key={category}>
              <span
                className={styles.legendOrb}
                aria-hidden="true"
                style={{ background: categoryOrbGradient(category) }}
              />
              <span>{worldCategoryName(category)}</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className={styles.labels} aria-label="Memory graph nodes">
        {worldNodes.map((node) => (
          <button
            className={styles.nodeLabel}
            data-category={node.category}
            data-selected={selectedKey === node.key ? "true" : "false"}
            key={node.key}
            type="button"
            ref={(element) => {
              if (element) labelRefs.current.set(node.key, element);
              else labelRefs.current.delete(node.key);
            }}
            onClick={() => {
              setSelectedKey(node.key);
            }}
          >
            {formatNodeLabel(node.label)}
          </button>
        ))}
      </div>

      <aside
        className={styles.inspector}
        data-open={selectedNode ? "true" : "false"}
        aria-hidden={!selectedNode}
        aria-live="polite"
      >
        {selectedNode ? (
          <>
            <button
              className={styles.closeButton}
              type="button"
              aria-label="Close memory detail"
              onClick={() => setSelectedKey(null)}
            >
              <span aria-hidden="true">×</span>
            </button>
            <div
              className={styles.inspectorOrb}
              aria-hidden="true"
              style={{
                background: categoryOrbGradient(selectedNode.category),
              }}
            />
            <div className={styles.taxonomy}>
              <span>{worldCategoryLabel(selectedNode)}</span>
              <span aria-hidden="true">·</span>
              <span>{humanizeExperienceSubtype(selectedNode.subtype)}</span>
            </div>
            <h2>{formatNodeLabel(selectedNode.label)}</h2>
            <p className={styles.description}>{selectedNode.description}</p>
            {selectedNode.category === "people" ? (
              selectedNode.linkedUserId || selectedNode.connectionId ? (
                <div className={styles.connectedStatus}>
                  <span aria-hidden="true" />
                  Connected on Chapter
                </div>
              ) : (
                <div className={styles.inviteAction}>
                  <button
                    type="button"
                    disabled={
                      inviteState?.nodeId === selectedNode.key &&
                      inviteState.status === "creating"
                    }
                    onClick={() => {
                      const currentInvite =
                        inviteState?.nodeId === selectedNode.key
                          ? inviteState
                          : null;
                      if (currentInvite?.url && currentInvite.status !== "error") {
                        shareInvite(selectedNode, currentInvite.url);
                      } else {
                        void prepareInvite(selectedNode);
                      }
                    }}
                  >
                    {inviteState?.nodeId === selectedNode.key &&
                    inviteState.status === "creating"
                      ? "Making invite…"
                      : inviteState?.nodeId === selectedNode.key &&
                          (inviteState.status === "ready" ||
                            inviteState.status === "shared")
                        ? inviteState.status === "shared"
                          ? "Share invite again"
                          : "Share invite"
                        : inviteState?.nodeId === selectedNode.key &&
                            inviteState.status === "error"
                          ? "Try invite again"
                          : `Invite ${formatNodeLabel(selectedNode.label)}`}
                  </button>
                </div>
              )
            ) : null}
            <div className={styles.evidence}>
              <span>
                {selectedNode.category === "self"
                  ? "How this world grows"
                  : selectedNode.sourceType === "connection"
                    ? "How you connected"
                    : "From what you told Chapter"}
              </span>
              <p>{selectedNode.evidence}</p>
            </div>
            {connectedItems.length > 0 ? (
              <div className={styles.connections}>
                <div className={styles.connectionsHeading}>
                  <span className={styles.connectionsLabel}>In your world</span>
                  <span className={styles.connectionsCount}>
                    {connectedItems.length} direct
                  </span>
                </div>
                <div className={styles.connectionList}>
                  {connectedItems.map(({ node, edge, direction }) => (
                    <button
                      className={styles.connectionButton}
                      type="button"
                      key={`${edge.from}:${edge.relation}:${edge.to}`}
                      aria-label={`Open ${formatNodeLabel(node.label)}, ${getExperienceRelationLabel(edge.relation, direction)}`}
                      onClick={() => {
                        selectedKeyRef.current = node.key;
                        setSelectedKey(node.key);
                      }}
                    >
                      <span
                        className={styles.connectionOrb}
                        aria-hidden="true"
                        style={{
                          background: categoryOrbGradient(node.category),
                        }}
                      />
                      <span className={styles.connectionCopy}>
                        <span className={styles.connectionName}>
                          {formatNodeLabel(node.label)}
                        </span>
                        <span className={styles.connectionMeta}>
                          {getExperienceRelationLabel(edge.relation, direction)} ·{" "}
                          {worldCategoryLabel(node)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </aside>

      <div className={styles.fallback} role="status">
        <p>Your world could not open in 3D on this device.</p>
      </div>
    </div>
  );
}
