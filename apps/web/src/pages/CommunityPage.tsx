import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AppPage,
  formStackClass,
  leadClass,
  listClass,
  listItemClass,
  outlinedCardClass,
} from "@/components/blocks/app-page";
import { ContentReportForm } from "@/components/blocks/content-report";
import { PageHeader } from "@/components/blocks/page-header";
import { PageTip } from "@/components/blocks/page-tip";
import {
  EmptyState,
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
  SuccessBanner,
} from "@/components/blocks/states";
import { Field, FieldTextarea } from "@/components/primitives/field";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import {
  ApiError,
  createCommunityPost,
  getCommunityGroups,
  getCommunityPosts,
  joinCommunityGroup,
  leaveCommunityGroup,
} from "@/lib/api";
import { apiBaseUrl } from "@/lib/config";
import type {
  CommunityGroupView,
  CommunityPost,
} from "../../../../packages/api-types/src/index";
import { COMMUNITY_POST_MAX } from "../../../../packages/domain/src/index";

function postError(code: string): string {
  if (code === "links_not_allowed") return "Links are not allowed.";
  if (code === "profanity") return "That wording is not allowed. Please rephrase.";
  if (code === "post_too_long") return "Keep posts to 500 characters.";
  if (code === "post_empty") return "Write something before posting.";
  if (code === "not_a_member") return "Join this group first.";
  return "Could not post.";
}

export function CommunityPage() {
  const online = useOnline();
  const [groups, setGroups] = useState<CommunityGroupView[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!apiBaseUrl) throw new ApiError(0, "api_base_url_missing");
      const res = await getCommunityGroups();
      setGroups(res.groups);
      setNote(res.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load groups");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPosts = useCallback(async (groupId: string) => {
    setError(null);
    try {
      const res = await getCommunityPosts(groupId);
      setPosts(res.posts);
    } catch (err) {
      if (err instanceof ApiError && err.code === "not_a_member") {
        setPosts([]);
        return;
      }
      setError(err instanceof Error ? err.message : "Could not load posts");
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (active) void loadPosts(active);
    else setPosts([]);
  }, [active, loadPosts]);

  const selected = groups.find((g) => g.id === active) ?? null;

  async function onJoin(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await joinCommunityGroup(id);
      setGroups((prev) => prev.map((g) => (g.id === id ? res.group : g)));
      setActive(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setBusy(false);
    }
  }

  async function onLeave(id: string) {
    setBusy(true);
    setError(null);
    try {
      await leaveCommunityGroup(id);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === id
            ? { ...g, joined: false, displayName: null, memberCount: Math.max(0, g.memberCount - 1) }
            : g,
        ),
      );
      if (active === id) {
        setPosts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave");
    } finally {
      setBusy(false);
    }
  }

  async function onPost(e: FormEvent) {
    e.preventDefault();
    if (!selected?.joined) return;
    setBusy(true);
    setError(null);
    setPosted(false);
    try {
      await createCommunityPost(selected.id, { body: draft });
      setDraft("");
      setPosted(true);
      await loadPosts(selected.id);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError(postError(code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppPage>
      <PageHeader
        eyebrow="Community"
        title="Peer groups"
        lead="Opt in by journey. Text only, 500 characters, no links, moderated. Names are anonymised. Leave any time."
      />
      <PageTip id="community" />
      {!online ? <OfflineBanner /> : null}
      {error ? (
        <ErrorBanner message={error} onRetry={() => void loadGroups()} />
      ) : null}
      {note ? <p className={leadClass}>{note}</p> : null}

      {loading ? (
        <div className="grid gap-4" aria-busy="true" aria-label="Loading groups">
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title="Groups unavailable"
          body="Connect to the API to join peer groups."
        />
      ) : (
        <ul className={listClass}>
          {groups.map((g) => (
            <li key={g.id} className={listItemClass}>
              <div className="grid gap-3">
                <button
                  type="button"
                  className="grid min-h-[var(--tap)] gap-1 rounded-[var(--radius)] border-0 bg-transparent p-0 text-left"
                  onClick={() => setActive(g.id)}
                >
                  <span className="text-[length:var(--text-sub)] font-semibold text-foreground">
                    {g.name}
                  </span>
                  <span className={leadClass}>{g.body}</span>
                  <span className="text-[length:var(--text-caption)] text-muted-foreground">
                    {g.memberCount} joined
                    {g.joined && g.displayName ? ` · you appear as ${g.displayName}` : ""}
                  </span>
                </button>
                <div className="flex flex-wrap gap-2">
                  {g.joined ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void onLeave(g.id)}
                    >
                      Leave
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={busy || !online || !apiBaseUrl}
                      onClick={() => void onJoin(g.id)}
                    >
                      Join
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <section className="grid gap-4 border-t border-border pt-6">
          <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
            {selected.name}
          </h2>
          {!selected.joined ? (
            <EmptyState
              title="Join to read and post"
              body="Membership is optional. You can leave whenever you want."
            />
          ) : (
            <>
              <form className={formStackClass} onSubmit={(e) => void onPost(e)}>
                <Field
                  id="community-post"
                  label="Write a post"
                  hint={`${draft.length} / ${COMMUNITY_POST_MAX}. No photos. No links. Held for moderation.`}
                >
                  <FieldTextarea
                    id="community-post"
                    maxLength={COMMUNITY_POST_MAX}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                </Field>
                {posted ? (
                  <SuccessBanner message="Held for moderation. It will show here as pending until a moderator reviews it." />
                ) : null}
                <Button type="submit" disabled={busy || !online || !draft.trim()}>
                  Post
                </Button>
              </form>
              {posts.length === 0 ? (
                <EmptyState
                  title="No posts yet"
                  body="Be the first when you have something useful to share. Keep it wellness, not diagnosis."
                />
              ) : (
                <ul className={listClass}>
                  {posts.map((p) => (
                    <li key={p.id} className={listItemClass}>
                      <article className={outlinedCardClass}>
                        <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
                          {p.authorDisplay}
                          {p.mine ? " · you" : ""}
                          {p.status === "pending" ? " · pending review" : ""}
                        </p>
                        <p className="m-0 mt-2 text-[length:var(--text-body)] text-foreground">
                          {p.body}
                        </p>
                        <div className="mt-3">
                          <ContentReportForm
                            targetType="post"
                            targetId={p.id}
                            online={online}
                            label="Report"
                          />
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      ) : null}
    </AppPage>
  );
}
