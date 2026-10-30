const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function scrollToId(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  // a pinned section lives inside GSAP's pin-spacer; aim for the spacer's top (frame one)
  const el = target.parentElement?.classList.contains("pin-spacer") ? target.parentElement : target;
  el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
}

/** "connect wallet": no wallet, just takes your eye straight to the contract address */
export function goToCa() {
  const panel = document.getElementById("ca-panel");
  if (!panel) return;
  panel.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    window.removeEventListener("scrollend", fire);
    window.dispatchEvent(new CustomEvent("watt:flash-ca"));
  };
  window.addEventListener("scrollend", fire, { once: true });
  // already in place, or no scrollend support
  setTimeout(fire, Math.abs(panel.getBoundingClientRect().top) < 40 ? 50 : 1100);
}
