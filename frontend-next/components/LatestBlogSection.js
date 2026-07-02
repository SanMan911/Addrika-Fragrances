import Link from 'next/link';

/**
 * Server component: renders the "From the Journal" strip on the home page.
 *
 * Auto-blog runs every ~3 days and populates `/api/blog/posts`. We surface
 * the three most-recent posts on the landing page so returning visitors
 * always see fresh brand voice content above the fold on tab back.
 *
 * Failure mode is silent — if the backend is unreachable at build/render
 * time, the section returns `null` and disappears cleanly rather than
 * breaking the landing page.
 */
async function fetchLatestPosts() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) return [];
  try {
    const r = await fetch(`${backendUrl}/api/blog/posts?limit=3`, {
      next: { revalidate: 300 }, // 5-min ISR
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return [];
    const data = await r.json();
    const posts = Array.isArray(data) ? data : data.posts || [];
    return posts.slice(0, 3);
  } catch {
    return [];
  }
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default async function LatestBlogSection() {
  const posts = await fetchLatestPosts();
  if (!posts.length) return null;

  return (
    <section
      className="relative py-20 sm:py-28 overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, #0f1419 0%, #1a1a2e 60%, #0f1419 100%)',
      }}
      data-testid="home-latest-blog"
    >
      {/* subtle gold radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,175,55,0.10), transparent 70%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
          <div>
            <p
              className="text-xs font-bold tracking-[3px] mb-2"
              style={{ color: '#D4AF37' }}
            >
              FROM THE JOURNAL
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Stories, rituals & scent notes
            </h2>
          </div>
          <Link
            href="/blog"
            data-testid="home-blog-view-all"
            className="text-sm font-semibold tracking-wide"
            style={{ color: '#D4AF37' }}
          >
            View all articles &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {posts.map((post) => (
            <Link
              key={post.slug || post.id}
              href={`/blog/${post.slug}`}
              className="group block rounded-xl overflow-hidden transition-transform duration-300 hover:-translate-y-1"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
                border: '1px solid rgba(212,175,55,0.22)',
              }}
              data-testid={`home-blog-card-${post.slug}`}
            >
              <div
                className="relative w-full h-44 overflow-hidden"
                style={{
                  background:
                    post.cover_image
                      ? `url("${post.cover_image}") center/cover`
                      : 'linear-gradient(135deg,#1a1a2e 0%,#22324a 100%)',
                }}
              >
                {!post.cover_image && (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-6xl font-black opacity-15"
                    style={{
                      color: '#D4AF37',
                      fontFamily: "'Playfair Display', serif",
                    }}
                  >
                    A
                  </div>
                )}
                <div
                  className="absolute inset-x-0 bottom-0 h-1/2"
                  style={{
                    background:
                      'linear-gradient(180deg, transparent 0%, rgba(15,20,25,0.85) 100%)',
                  }}
                />
              </div>

              <div className="p-5">
                <p
                  className="text-[10px] tracking-[2px] font-bold mb-2"
                  style={{ color: '#D4AF37' }}
                >
                  {fmtDate(post.published_at || post.created_at)}
                </p>
                <h3
                  className="text-base font-semibold text-white leading-snug line-clamp-2 mb-2 group-hover:text-[#D4AF37] transition-colors"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {post.title}
                </h3>
                <p className="text-xs text-white/60 line-clamp-3 leading-relaxed">
                  {post.excerpt || ''}
                </p>
                <div
                  className="mt-4 inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: '#D4AF37' }}
                >
                  Read article
                  <span className="transition-transform group-hover:translate-x-0.5">
                    &rarr;
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
