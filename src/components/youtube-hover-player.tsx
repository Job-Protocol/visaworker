import { useState } from "react";

interface YouTubeHoverPlayerProps {
  videoId: string;
  title: string;
  className?: string;
}

// Lite YouTube facade: renders a thumbnail + play button, and only loads the
// real iframe (with autoplay + sound) once the user clicks. Standard best-in-
// class pattern — no autoplay-muted, no hover-triggered audio, faster LCP.
export function YouTubeHoverPlayer({ videoId, title, className }: YouTubeHoverPlayerProps) {
  const [activated, setActivated] = useState(false);
  const [thumbSrc, setThumbSrc] = useState(
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
  );

  const embedSrc = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

  return (
    <div className={className}>
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
        {activated ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={embedSrc}
            title={title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setActivated(true)}
            aria-label={`Play video: ${title}`}
            className="group absolute inset-0 block h-full w-full cursor-pointer overflow-hidden bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <img
              src={thumbSrc}
              alt={title}
              loading="lazy"
              onError={() => {
                // Fallback if maxresdefault isn't available for this video.
                if (!thumbSrc.includes("hqdefault")) {
                  setThumbSrc(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
                }
              }}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
            {/* Soft gradient for legibility of the play affordance */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/10"
            />
            {/* Play button */}
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 flex h-16 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 shadow-lg backdrop-blur-sm transition-all duration-200 ease-out group-hover:scale-110 group-hover:bg-[#e11d2a] md:h-20 md:w-28"
            >
              <svg
                viewBox="0 0 24 24"
                className="ml-1 h-8 w-8 fill-white md:h-9 md:w-9"
                aria-hidden
              >
                <path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14Z" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
