(function () {
  const host = window.location.hostname;
  const isDothome = host === "photographygju.dothome.co.kr" || host === "admin.photographygju.dothome.co.kr";

  window.GJU_API_BASE = isDothome
    ? "https://photographygju-reserve.taejunyun.workers.dev"
    : "";
})();
