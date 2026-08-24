/**
 * پس‌زمینه سه‌بعدی سبک با Three.js — برای موبایل بهینه شده
 * افکت: گوی‌های شیشه‌ای شناور + ذرات نرم + پارالاکس خفیف
 */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const IS_MOBILE = /iPhone|iPad|Android/i.test(navigator.userAgent) || window.innerWidth < 700;

(function initThreeScene() {
  if (REDUCED) return;

  const canvas = document.getElementById("threeBg");
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !IS_MOBILE,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xfbf7f0, 0.045);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 8);

  // نور محیطی نرم
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xc5e8d5, 0.9);
  key.position.set(3, 4, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xf5cbbe, 0.35);
  fill.position.set(-4, -2, 2);
  scene.add(fill);

  // ---------- گوی‌های شیشه‌ای ----------
  const orbs = [];
  const orbCount = IS_MOBILE ? 5 : 8;
  const orbGeo = new THREE.SphereGeometry(1, IS_MOBILE ? 24 : 36, IS_MOBILE ? 24 : 36);

  const colors = [0x2f7a72, 0x4fa89e, 0xc5e8d5, 0xf5cbbe, 0x163f3c, 0xe8d5a3];

  for (let i = 0; i < orbCount; i++) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: colors[i % colors.length],
      transparent: true,
      opacity: 0.28 + (i % 3) * 0.06,
      roughness: 0.15,
      metalness: 0.05,
      transmission: 0.55,
      thickness: 0.8,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    });
    const mesh = new THREE.Mesh(orbGeo, mat);
    const scale = 0.55 + Math.random() * 1.1;
    mesh.scale.setScalar(scale);
    mesh.position.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 12,
      -2 - Math.random() * 6
    );
    mesh.userData = {
      base: mesh.position.clone(),
      speed: 0.15 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
      amp: 0.25 + Math.random() * 0.55,
      rot: (Math.random() - 0.5) * 0.4,
    };
    scene.add(mesh);
    orbs.push(mesh);
  }

  // ---------- ذرات ----------
  const particleCount = IS_MOBILE ? 60 : 120;
  const pGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const pPhases = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 14;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 2] = -1 - Math.random() * 8;
    pPhases[i] = Math.random() * Math.PI * 2;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0x2f7a72,
    size: IS_MOBILE ? 0.06 : 0.05,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  // ---------- حلقه مینیمال ----------
  const torusGeo = new THREE.TorusGeometry(2.2, 0.035, 12, IS_MOBILE ? 48 : 80);
  const torusMat = new THREE.MeshBasicMaterial({
    color: 0x2f7a72,
    transparent: true,
    opacity: 0.18,
  });
  const torus = new THREE.Mesh(torusGeo, torusMat);
  torus.position.set(0, 0.5, -3);
  torus.rotation.x = Math.PI * 0.35;
  scene.add(torus);

  // پارالاکس
  let targetX = 0, targetY = 0;
  let curX = 0, curY = 0;

  function onPointer(e) {
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    targetX = (x / window.innerWidth - 0.5) * 0.8;
    targetY = (y / window.innerHeight - 0.5) * 0.5;
  }
  window.addEventListener("pointermove", onPointer, { passive: true });

  // Device orientation (اختیاری، سبک)
  if (window.DeviceOrientationEvent && IS_MOBILE) {
    window.addEventListener(
      "deviceorientation",
      (e) => {
        if (e.gamma == null || e.beta == null) return;
        targetX = Math.max(-1, Math.min(1, e.gamma / 45)) * 0.5;
        targetY = Math.max(-1, Math.min(1, (e.beta - 45) / 45)) * 0.35;
      },
      { passive: true }
    );
  }

  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) animate();
  });

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener("resize", onResize, { passive: true });

  // حالت خوش‌آمد — شدت بیشتر
  let intensity = 1;
  const welcome = document.getElementById("welcomeScreen");
  function syncWelcome() {
    const active = welcome && !welcome.classList.contains("hidden") && getComputedStyle(welcome).display !== "none";
    intensity = active ? 1.35 : 1;
    pMat.opacity = active ? 0.65 : 0.4;
    torusMat.opacity = active ? 0.28 : 0.16;
  }
  if (welcome) {
    const mo = new MutationObserver(syncWelcome);
    mo.observe(welcome, { attributes: true, attributeFilter: ["class", "style", "hidden"] });
  }
  // وقتی welcome محو می‌شود
  setInterval(syncWelcome, 800);

  const clock = new THREE.Clock();
  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    curX += (targetX - curX) * 0.04;
    curY += (targetY - curY) * 0.04;
    camera.position.x = curX * 0.6;
    camera.position.y = -curY * 0.4;
    camera.lookAt(0, 0, -2);

    for (const mesh of orbs) {
      const u = mesh.userData;
      mesh.position.x = u.base.x + Math.sin(t * u.speed + u.phase) * u.amp * intensity;
      mesh.position.y = u.base.y + Math.cos(t * u.speed * 0.85 + u.phase) * u.amp * 0.8 * intensity;
      mesh.rotation.y += 0.002 * u.rot;
      mesh.rotation.x += 0.0015 * u.rot;
    }

    const pos = points.geometry.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3 + 1] += Math.sin(t * 0.4 + pPhases[i]) * 0.0015 * intensity;
    }
    points.geometry.attributes.position.needsUpdate = true;
    points.rotation.y = t * 0.02;

    torus.rotation.z = t * 0.08;
    torus.rotation.x = Math.PI * 0.35 + Math.sin(t * 0.2) * 0.08;

    renderer.render(scene, camera);
  }
  animate();

  // API کوچک برای تب‌ها (تغییر رنگ مه‌آلود)
  window.__dakhlThree = {
    setPastMonth(isPast) {
      scene.fog.color.set(isPast ? 0xf2e7d3 : 0xfbf7f0);
    },
  };
})();
