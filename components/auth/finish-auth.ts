type AuthNavigate = (params: {
  session: { currentTask?: { key: string } | null };
  decorateUrl: (url: string) => string;
}) => Promise<void>;

export function chapterAuthNavigate(
  redirectUrl: string,
  replace: (href: string) => void,
): AuthNavigate {
  return async ({ session, decorateUrl }) => {
    const destination = session.currentTask
      ? `/sign-in/tasks/${session.currentTask.key}`
      : redirectUrl;
    const url = decorateUrl(destination);
    if (url.startsWith("http")) {
      window.location.assign(url);
      return;
    }
    replace(url);
  };
}
