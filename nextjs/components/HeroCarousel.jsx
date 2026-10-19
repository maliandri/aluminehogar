'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const INTERVALO_MS = 6000;

// Carrusel de promociones del inicio. Recibe solo slides activos (al menos uno).
export default function HeroCarousel({ slides, tituloSeo }) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const touchStartX = useRef(null);
  const total = slides.length;
  const current = indice % total; // por si cambia la cantidad de slides

  const ir = useCallback((i) => setIndice(((i % total) + total) % total), [total]);

  useEffect(() => {
    if (total < 2 || pausado) return undefined;
    const t = setInterval(() => setIndice((c) => (c + 1) % total), INTERVALO_MS);
    return () => clearInterval(t);
  }, [total, pausado, current]);

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    ir(dx < 0 ? current + 1 : current - 1);
  };

  return (
    <section
      id="inicio"
      aria-roledescription="carrusel"
      aria-label="Promociones"
      className="relative w-full h-[320px] sm:h-[420px] lg:h-[500px] overflow-hidden bg-gray-900 text-white"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <h1 className="sr-only">{tituloSeo}</h1>

      {slides.map((s, i) => (
        <div key={`${s.imagen}-${i}`} aria-hidden={i !== current}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <Image src={s.imagen} alt={s.titulo || 'Promoción'} fill sizes="100vw"
            className="object-cover object-center" priority={i === 0} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />
          {(s.titulo || s.subtitulo || (s.botonTexto && s.botonEnlace)) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 sm:px-16">
              {s.titulo && <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold mb-3 text-shadow max-w-4xl">{s.titulo}</h2>}
              {s.subtitulo && <p className="text-base sm:text-xl lg:text-2xl mb-6 text-shadow max-w-2xl">{s.subtitulo}</p>}
              {s.botonTexto && s.botonEnlace && (
                <a href={s.botonEnlace} tabIndex={i === current ? 0 : -1} className="btn-primary inline-block text-base sm:text-lg">
                  {s.botonTexto}
                </a>
              )}
            </div>
          )}
        </div>
      ))}

      {total > 1 && (
        <>
          <button type="button" onClick={() => ir(current - 1)} aria-label="Promoción anterior"
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/30 hover:bg-black/50 items-center justify-center transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button type="button" onClick={() => ir(current + 1)} aria-label="Promoción siguiente"
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/30 hover:bg-black/50 items-center justify-center transition-colors">
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((_, i) => (
              <button key={i} type="button" onClick={() => ir(i)} aria-label={`Ir a la promoción ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
