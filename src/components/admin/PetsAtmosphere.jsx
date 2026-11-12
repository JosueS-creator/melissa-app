import React from 'react'

const huellas = [
  ['5%', '18%', '-18deg', '0s'], ['18%', '72%', '22deg', '-3s'],
  ['31%', '34%', '-12deg', '-6s'], ['44%', '82%', '18deg', '-2s'],
  ['58%', '22%', '-22deg', '-8s'], ['69%', '63%', '16deg', '-4s'],
  ['82%', '30%', '-14deg', '-1s'], ['93%', '78%', '24deg', '-7s'],
  ['11%', '48%', '12deg', '-5s'], ['38%', '12%', '-24deg', '-9s'],
  ['75%', '12%', '20deg', '-10s'], ['55%', '72%', '-16deg', '-11s'],
]

function Huella({ className = '', style = {} }) {
  return (
    <svg className={className} style={style} viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">
      <ellipse cx="24" cy="31" rx="10" ry="8" />
      <ellipse cx="10.5" cy="18" rx="5.2" ry="7" transform="rotate(-24 10.5 18)" />
      <ellipse cx="21" cy="11" rx="5.1" ry="7" transform="rotate(-7 21 11)" />
      <ellipse cx="33" cy="12" rx="5.1" ry="7" transform="rotate(13 33 12)" />
      <ellipse cx="41" cy="22" rx="4.6" ry="6.2" transform="rotate(28 41 22)" />
    </svg>
  )
}

/**
 * Decoración ambiental exclusiva de Melissa Pets.
 * No captura eventos, no altera el flujo ni la estructura funcional del panel.
 */
export default function PetsAtmosphere() {
  return (
    <>
      <div className="pets-atmosphere" aria-hidden="true">
        <div className="pets-atmosphere__glow pets-atmosphere__glow--one" />
        <div className="pets-atmosphere__glow pets-atmosphere__glow--two" />
        {huellas.map(([left, top, rotation, delay], index) => (
          <Huella
            key={index}
            className="pets-atmosphere__paw"
            style={{ left, top, '--paw-rotation': rotation, '--paw-delay': delay }}
          />
        ))}
        <div className="pets-atmosphere__wordmark">PETS</div>
      </div>
      <style>{`
        .panel-admin.pets-theme {
          position: relative;
          isolation: isolate;
          background:
            radial-gradient(ellipse at 82% 16%, rgba(211, 229, 216, .28), transparent 34%),
            linear-gradient(145deg, #f8faf7 0%, #f2f6f1 48%, #f8f7f2 100%);
        }
        .panel-admin.pets-theme > :not(.pets-atmosphere) {
          position: relative;
          z-index: 1;
        }
        .pets-atmosphere {
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
          color: #789b83;
        }
        .pets-atmosphere__glow {
          position: absolute;
          width: min(42vw, 560px);
          aspect-ratio: 1;
          border-radius: 50%;
          filter: blur(2px);
          opacity: .34;
        }
        .pets-atmosphere__glow--one {
          right: -12vw;
          top: 8vh;
          background: radial-gradient(circle, rgba(194, 220, 199, .38), transparent 68%);
        }
        .pets-atmosphere__glow--two {
          left: 18vw;
          bottom: -28vh;
          background: radial-gradient(circle, rgba(231, 218, 190, .34), transparent 68%);
        }
        .pets-atmosphere__paw {
          position: absolute;
          width: clamp(17px, 1.8vw, 27px);
          height: auto;
          opacity: 0;
          transform: rotate(var(--paw-rotation)) scale(.72);
          animation: pets-paw-walk 17s ease-in-out var(--paw-delay) infinite;
          filter: drop-shadow(0 2px 2px rgba(54, 82, 62, .06));
        }
        .pets-atmosphere__paw:nth-of-type(odd) { color: #d1a98f; }
        .pets-atmosphere__wordmark {
          position: absolute;
          right: 3vw;
          bottom: -5vh;
          font-size: clamp(100px, 20vw, 290px);
          line-height: 1;
          font-weight: 800;
          letter-spacing: -.09em;
          color: rgba(116, 151, 124, .035);
          user-select: none;
        }
        @keyframes pets-paw-walk {
          0% { opacity: 0; transform: translate3d(0, 22px, 0) rotate(var(--paw-rotation)) scale(.72); }
          12% { opacity: .18; }
          72% { opacity: .15; }
          100% { opacity: 0; transform: translate3d(54px, -68px, 0) rotate(calc(var(--paw-rotation) + 24deg)) scale(1.02); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pets-atmosphere__paw { animation: none; opacity: .075; transform: rotate(var(--paw-rotation)); }
        }
        @media (max-width: 640px) {
          .pets-atmosphere__paw { width: 18px; }
          .pets-atmosphere__glow { width: 75vw; }
          .pets-atmosphere__wordmark { font-size: 38vw; bottom: 1vh; }
        }
      `}</style>
    </>
  )
}
