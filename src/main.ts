function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

setText("build-version", __APP_VERSION__);
setText("build-sha", __GIT_SHA__);
