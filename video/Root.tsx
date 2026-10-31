import { Composition, continueRender, delayRender } from "remotion";
import "../app/globals.css";
import "./video.css";
import { Promo } from "./Promo";
import { Avatar, Banner } from "./Brand";
import { T } from "./lib";

// the site's fonts, straight from Google Fonts; rendering waits until they're in
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Big+Shoulders+Stencil:opsz,wght@10..72,100..900&family=Saira+Stencil+One&family=Manrope:wght@400..800&family=JetBrains+Mono:wght@400..800&display=block";

if (typeof document !== "undefined" && !document.getElementById("watt-fonts")) {
  const handle = delayRender("fonts");
  const link = document.createElement("link");
  link.id = "watt-fonts";
  link.rel = "stylesheet";
  link.href = FONTS_URL;
  link.onload = () =>
    Promise.all([
      document.fonts.load('800 100px "Big Shoulders Stencil"'),
      document.fonts.load('900 100px "Big Shoulders Stencil"'),
      document.fonts.load('400 100px "Saira Stencil One"'),
      document.fonts.load('600 20px "Manrope"'),
      document.fonts.load('700 40px "JetBrains Mono"'),
    ]).then(() => continueRender(handle));
  link.onerror = () => continueRender(handle);
  document.head.appendChild(link);
}

export function Root() {
  return (
    <>
      <Composition id="Promo" component={Promo} durationInFrames={T.frames} fps={T.fps} width={1920} height={1080} />
      <Composition id="PromoVertical" component={Promo} durationInFrames={T.frames} fps={T.fps} width={1080} height={1920} />
      <Composition id="Avatar" component={Avatar} durationInFrames={1} fps={30} width={1000} height={1000} />
      <Composition id="Banner" component={Banner} durationInFrames={1} fps={30} width={3000} height={1000} />
    </>
  );
}
