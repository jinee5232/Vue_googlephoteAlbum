// Lenis 平滑捲動 + GSAP ScrollTrigger 同步
// 彈出視窗（大圖、幻燈片、表單）加上 data-lenis-prevent，裡面的捲動就不會被 Lenis 接管
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const lenis: Lenis | null = reduceMotion
  ? null
  : new Lenis({ lerp: 0.1, wheelMultiplier: 1 });

if (lenis) {
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/** 換頁時回到頂端（不要平滑捲動） */
export const resetScroll = () => {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
};

/** 開彈出視窗時停止背景捲動 */
export const lockScroll = () => {
  lenis?.stop();
  document.body.style.overflow = "hidden";
};
export const unlockScroll = () => {
  lenis?.start();
  document.body.style.overflow = "";
};
