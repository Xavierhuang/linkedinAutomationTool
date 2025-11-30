import React from 'react';
import designTokens from '@/designTokens';

const PostPreviewCard = ({ posts }) => {
  if (!posts || posts.length === 0) {
    return null;
  }

  return (
    <div
      className="w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-6 space-y-4"
      style={{
        boxShadow: designTokens.shadow.md,
      }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-white/60">First Week Plan</p>
        <h4 className="text-lg font-semibold text-white mt-2">Seven Day Post Preview</h4>
        <p className="text-sm text-white/60 mt-2 leading-relaxed">
          These draft concepts follow the approved campaign tone and focus. You can edit any post directly after review.
        </p>
      </div>

      <div className="space-y-3">
        {posts.slice(0, 7).map((post, index) => (
          <div
            key={`${index}-${post.slice(0, 20)}`}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl flex items-center justify-center text-sm font-semibold text-black"
                style={{
                  background: designTokens.colors.accent.green,
                  boxShadow: designTokens.shadow.glow,
                }}
              >
                {index + 1}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                  Day {index + 1}
                </p>
                <p className="text-sm text-white/80 leading-relaxed mt-1">{post}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-white/10 rounded-2xl p-4 bg-white/5 text-xs text-white/60 leading-relaxed">
        Posts generate as editable drafts. Approving a draft sends it to the review queue before scheduling.
      </div>
    </div>
  );
};

export default PostPreviewCard;





