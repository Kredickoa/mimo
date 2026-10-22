import './style.css';
import * as THREE from 'three';
import { LampScene } from './scene.js';

const canvas = document.querySelector('#lamp-canvas');
const status = document.querySelector('#model-status');
const headline = document.querySelector('.hero-title');
const background = document.querySelector('.landscape');
const features = document.querySelector('.features');
const detailsTitle = document.querySelector('.details-title');
const heroBottom = document.querySelector('.hero-bottom');
const detailBottom = document.querySelector('.detail-bottom');
const light = document.querySelector('#site-light');
const navLinks = document.querySelectorAll('.nav-pill[data-scroll]');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
document.querySelectorAll('[data-scroll]').forEach(button => button.addEventListener('click', () => {
  document.getElementById(button.dataset.scroll)?.scrollIntoView({behavior:'auto'});
}));
const copy = headline.textContent;
headline.textContent = '';
for (const character of copy) {
  const span = document.createElement('span');
  span.textContent = character;
  span.setAttribute('aria-hidden', 'true');
  headline.append(span);
}
const letters = [...headline.children];
const smooth = (a,b,x) => THREE.MathUtils.smoothstep(x,a,b);
let targetProgress = scrollY / innerHeight, progress = targetProgress;
let frame = 0, lastTime = performance.now(), lit = true, rig;
function fallback(error) {
  console.error('Mimo 3D unavailable',error);
  canvas.hidden = true;
  document.querySelector('#scene-fallback').hidden = false;
  status.textContent = 'Podgląd statyczny. Scena 3D wymaga WebGL.';
  light.disabled = true;
}
try {
  rig = new LampScene(canvas,{floating:true,onReady:() => {canvas.dataset.ready='true';status.hidden=true},onError:fallback});
  rig.setLight(1);
} catch(error) {fallback(error)}
const onScroll = () => {targetProgress = scrollY / innerHeight};
addEventListener('scroll',onScroll,{passive:true});
addEventListener('resize',onScroll,{passive:true});
light.addEventListener('click',() => {
  lit = !lit;
  rig?.setLight(Number(lit));
  light.setAttribute('aria-pressed',String(lit));
  const label = lit ? 'Wyłącz światło' : 'Włącz światło';
  light.setAttribute('aria-label', label);
  light.title = label;
  light.firstElementChild.src = lit ? './icons/moon.svg' : './icons/sun.svg';
});
document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.dialog).showModal()));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
function update(time) {
  if(document.hidden) return;
  const delta = Math.min((time-lastTime)/1000,.05);
  lastTime=time;
  progress = reduceMotion ? targetProgress : THREE.MathUtils.lerp(progress,targetProgress,1-Math.exp(-delta*6));
  const phase = smooth(.12,1.15,progress);
  const reveal = smooth(.80,1.24,progress);
  const exploded = reduceMotion ? Number(progress > 1.7) : smooth(1.42,2.65,progress);
  rig?.setExploded(exploded);
  background.style.transform = `translateY(${-phase*20}%)`;
  background.style.filter = lit ? 'brightness(.42)' : 'none';
  for (let i=0;i<letters.length;i++) {
    const leave = smooth(.10+i*.018,.52+i*.025,progress);
    letters[i].style.transform = reduceMotion ? 'none' : `translate(${leave*(-100+i*9)}px,${-leave*(420+(letters.length-i)*20)}px) rotate(${leave*(-27+i*3)}deg)`;
    letters[i].style.opacity = String(1-smooth(.4,.93,leave));
  }
  features.style.opacity = String(reveal);
  features.style.transform = `translateY(${(1-reveal)*35}px)`;
  detailsTitle.style.opacity = String(reveal);
  detailsTitle.style.transform = `translateY(${(1-reveal)*70}px)`;
  heroBottom.style.opacity = String(1-smooth(.15,.58,progress));
  heroBottom.style.pointerEvents = progress<.6 ? 'auto':'none';
  detailBottom.style.opacity = String(reveal);
  detailBottom.style.pointerEvents = reveal>.95 ? 'auto':'none';
  document.body.dataset.phase = reveal>.95 ? 'details':'intro';
  const activeSection = reveal > .5 ? 'details' : progress > .45 ? 'lamps' : 'top';
  navLinks.forEach(a=>a.classList.toggle('active',a.dataset.scroll===activeSection));
  rig?.setPose({
    x:0,y:THREE.MathUtils.lerp(THREE.MathUtils.lerp(-.17,.68,phase),1.06,exploded),
    rotation:reduceMotion ? .12 : .12+phase*Math.PI*2,
    pitch:reduceMotion?0:Math.sin(phase*Math.PI)*.35+exploded*.09,
    tilt:reduceMotion?0:-Math.sin(phase*Math.PI)*.27,
    scale:THREE.MathUtils.lerp(THREE.MathUtils.lerp(.63,.58,phase),.43,exploded),
  });
  frame=requestAnimationFrame(update);
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden) cancelAnimationFrame(frame);
  else {lastTime=performance.now();frame=requestAnimationFrame(update)}
});
frame=requestAnimationFrame(update);
addEventListener('pagehide',()=>{cancelAnimationFrame(frame);rig?.dispose()},{once:true});
