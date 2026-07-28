let chapterMarkRequest: Promise<string> | null = null;

function chapterMarkSvg() {
  chapterMarkRequest ??= fetch("/chapter-mark.svg").then((response) => {
    if (!response.ok) throw new Error("Chapter mark could not be loaded.");
    return response.text();
  });
  return chapterMarkRequest;
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function drawChapterMark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const svg = await chapterMarkSvg();
  const forced = svg.replace(
    /<svg([^>]*)>/i,
    `<svg$1><style>*{fill:#fff!important;stroke:#fff!important}</style>`,
  );
  const url = URL.createObjectURL(
    new Blob([forced], { type: "image/svg+xml" }),
  );

  try {
    const image = await loadImage(url);
    const target = height * 0.64;
    const aspect = image.width / Math.max(1, image.height);
    const drawWidth = target * aspect;
    context.drawImage(
      image,
      width / 2 - drawWidth / 2,
      height / 2 - target / 2,
      drawWidth,
      target,
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function makeEmbossField({
  number,
  blur,
  width,
  height,
}: {
  number: string;
  blur: number;
  width: number;
  height: number;
}) {
  const fieldWidth = Math.max(2, Math.round(width));
  const fieldHeight = Math.max(2, Math.round(height));

  const crisp = document.createElement("canvas");
  crisp.width = fieldWidth;
  crisp.height = fieldHeight;
  const crispContext = crisp.getContext("2d");
  if (!crispContext) throw new Error("Emboss mask is unavailable.");

  crispContext.clearRect(0, 0, fieldWidth, fieldHeight);
  crispContext.fillStyle = "#fff";
  crispContext.font = `600 ${Math.max(22, fieldHeight * 0.046)}px "Instrument Sans", sans-serif`;
  crispContext.textAlign = "left";
  crispContext.textBaseline = "top";
  crispContext.fillText(number, fieldWidth * 0.075, fieldHeight * 0.062);
  await drawChapterMark(crispContext, fieldWidth, fieldHeight);

  const softened = document.createElement("canvas");
  softened.width = fieldWidth;
  softened.height = fieldHeight;
  const softenedContext = softened.getContext("2d");
  if (!softenedContext) throw new Error("Emboss blur is unavailable.");
  softenedContext.filter = `blur(${Math.max(0.5, blur).toFixed(2)}px)`;
  softenedContext.drawImage(crisp, 0, 0);
  softenedContext.filter = "none";

  const packed = document.createElement("canvas");
  packed.width = fieldWidth;
  packed.height = fieldHeight;
  const packedContext = packed.getContext("2d");
  if (!packedContext) throw new Error("Emboss field is unavailable.");

  const crispPixels = crispContext.getImageData(
    0,
    0,
    fieldWidth,
    fieldHeight,
  ).data;
  const softPixels = softenedContext.getImageData(
    0,
    0,
    fieldWidth,
    fieldHeight,
  ).data;
  const output = packedContext.createImageData(fieldWidth, fieldHeight);

  for (let index = 0; index < output.data.length; index += 4) {
    output.data[index] = crispPixels[index + 3];
    output.data[index + 1] = softPixels[index + 3];
    output.data[index + 2] = 0;
    output.data[index + 3] = 255;
  }

  packedContext.putImageData(output, 0, 0);
  return packed;
}
