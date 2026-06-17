import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Plus, LogOut, Trash2, Share2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getAuth } from "firebase/auth";
import { useClubDetail, useClubMemberProfiles, leaveClub, kickMember, createSeason, endSeason, saveTournamentToClub, removeTournamentFromClub, approveJoinRequest, rejectJoinRequest } from "../hooks/useClub";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { doc, deleteDoc, getDocs, collection } from "firebase/firestore";
import { firestore, db } from "../firebase";
import { ref, get } from "firebase/database";

async function deleteClub(clubId, adminUid) {
  // Delete all subcollections
  for (const sub of ["members", "pendingMembers", "tournaments", "seasons"]) {
    const snap = await getDocs(collection(firestore, "clubs", clubId, sub));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  }
  await deleteDoc(doc(firestore, "clubs", clubId));
  // Remove from all members' user docs
  // Note: other members' clubs array will have a stale reference — harmless, useClubs filters missing clubs
}

function MembersTab({ members, pendingMembers, club, isAdmin, clubId, navigate, memberProfiles }) {
  const uid = getAuth().currentUser?.uid;
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmKick, setConfirmKick] = useState(null); // uid of member to kick

  const handleLeave = async () => {
    await leaveClub(clubId);
    navigate("/clubs");
  };

  const handleDelete = async () => {
    await deleteClub(clubId, uid);
    navigate("/clubs");
  };

  return (
    <div>
      {/* Pending requests — admin only */}
      {isAdmin() && pendingMembers.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#f59e0b", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            ⏳ PENDING REQUESTS
            <span style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{pendingMembers.length}</span>
          </div>
          {pendingMembers.map(m => {
            const pName = m.playerName || m.name;
            const avatarProfile = m.avatar || (m.photoURL ? { type: "image", value: m.photoURL } : null);
            return (
              <div key={m.uid} className="glass-card" style={{ borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, border: "1px solid rgba(245,158,11,0.25)" }}>
                <PlayerAvatar name={pName} profile={avatarProfile} size={36} expandable />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>{pName}</div>
                  <div style={{ fontSize: 11, color: "var(--color-muted)" }}>Wants to join</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="pb" onClick={() => rejectJoinRequest(clubId, m.uid)}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "var(--color-danger)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    REJECT
                  </button>
                  <button className="pb" onClick={() => approveJoinRequest(clubId, m.uid)}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "var(--color-lime)", color: "#0d0f0a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    APPROVE
                  </button>
                </div>
              </div>
            );
          })}
          <div style={{ height: 1, background: "var(--color-border)", marginBottom: 16 }} />
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 12 }}>
        {members.length} member{members.length !== 1 ? "s" : ""}
      </div>
      {members.map(m => {
        const live = memberProfiles?.[m.uid];
        const pName = live?.displayName || m.playerName || m.name;
        const avatarProfile = live?.avatar || m.avatar || (m.photoURL ? { type: "image", value: m.photoURL } : null);
        const isMe = m.uid === uid;
        const canKick = isAdmin() && !isMe && m.role !== "admin";
        return (
          <div key={m.uid}>
            <div className="glass-card" style={{ borderRadius: confirmKick === m.uid ? "12px 12px 0 0" : 12, padding: "12px 14px", marginBottom: confirmKick === m.uid ? 0 : 8, display: "flex", alignItems: "center", gap: 12 }}>
              <PlayerAvatar name={pName} profile={avatarProfile} size={36} expandable />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)", display: "flex", alignItems: "center", gap: 6 }}>
                  {pName}
                  {isMe && <span style={{ fontSize: 9, background: "rgba(16,212,142,0.15)", color: "var(--color-lime)", padding: "2px 6px", borderRadius: 4, fontWeight: 700, letterSpacing: 1 }}>YOU</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-muted)" }}>
                  {m.role === "admin" ? "👑 Admin" : "Member"}
                </div>
              </div>
              {canKick && confirmKick !== m.uid && (
                <button className="pb" onClick={() => setConfirmKick(m.uid)}
                  style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "var(--color-danger)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  KICK
                </button>
              )}
            </div>
            {confirmKick === m.uid && (
              <div className="glass-card" style={{ borderRadius: "0 0 12px 12px", padding: "10px 14px", marginBottom: 8, border: "1px solid rgba(239,68,68,0.3)", borderTop: "none" }}>
                <div style={{ fontSize: 12, color: "var(--color-text)", marginBottom: 8 }}>Remove <strong>{pName}</strong> from the club?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmKick(null)} style={{ flex: 1, padding: "8px", borderRadius: 7, border: "1px solid var(--color-border)", background: "none", color: "var(--color-muted)", fontSize: 12, cursor: "pointer" }}>CANCEL</button>
                  <button onClick={async () => { await kickMember(clubId, m.uid); setConfirmKick(null); }}
                    style={{ flex: 1, padding: "8px", borderRadius: 7, border: "none", background: "var(--color-danger)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    REMOVE
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Leave / Delete buttons */}
      <div style={{ marginTop: 24 }}>
        {!isAdmin() && (
          <>
            {!confirmLeave ? (
              <button className="pb" onClick={() => setConfirmLeave(true)}
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "var(--color-danger)", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <LogOut size={15} /> LEAVE CLUB
              </button>
            ) : (
              <div className="glass-card" style={{ borderRadius: 10, padding: "1rem", border: "1px solid rgba(239,68,68,0.3)" }}>
                <div style={{ fontSize: 13, color: "var(--color-text)", marginBottom: 10 }}>Leave this club? Your match history stays but you'll lose access.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmLeave(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid var(--color-border)", background: "none", color: "var(--color-muted)", cursor: "pointer" }}>CANCEL</button>
                  <button onClick={handleLeave} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "var(--color-danger)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>LEAVE</button>
                </div>
              </div>
            )}
          </>
        )}

        {isAdmin() && (
          <>
            {!confirmDelete ? (
              <button className="pb" onClick={() => setConfirmDelete(true)}
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "var(--color-danger)", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Trash2 size={15} /> DELETE CLUB
              </button>
            ) : (
              <div className="glass-card" style={{ borderRadius: 10, padding: "1rem", border: "1px solid rgba(239,68,68,0.3)" }}>
                <div style={{ fontSize: 13, color: "var(--color-text)", marginBottom: 4 }}>Delete this club permanently?</div>
                <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 10 }}>All members will lose access. Match history is not deleted.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid var(--color-border)", background: "none", color: "var(--color-muted)", cursor: "pointer" }}>CANCEL</button>
                  <button onClick={handleDelete} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "var(--color-danger)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>DELETE</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LeaderboardTab({ members, tournaments, memberProfiles }) {
  // Compute stats from club tournaments
  // Use lowercase keys for matching since tournament names may differ in case
  const stats = {};
  const keyMap = {}; // lowercase → original key
  members.forEach(m => {
    const live = memberProfiles?.[m.uid];
    const key = live?.displayName || m.playerName || m.name;
    const lkey = key.toLowerCase();
    const avatarProfile = live?.avatar || m.avatar || (m.photoURL ? { type: "image", value: m.photoURL } : null);
    stats[lkey] = { name: key, uid: m.uid, avatar: avatarProfile, wins: 0, losses: 0, titles: 0, matches: 0 };
    keyMap[lkey] = lkey;
  });

  tournaments.forEach(t => {
    if (!t.players) return;
    // Count titles — case insensitive
    if (t.champion) {
      t.champion.split(" & ").map(s => s.trim().toLowerCase()).forEach(p => {
        if (stats[p]) stats[p].titles++;
      });
    }
    // Aggregate wins/losses — case insensitive
    if (t.playerStats) {
      Object.entries(t.playerStats).forEach(([name, s]) => {
        const lname = name.toLowerCase();
        if (stats[lname]) {
          stats[lname].wins += s.wins || 0;
          stats[lname].losses += s.losses || 0;
          stats[lname].matches += s.matches || 0;
        }
      });
    }
  });

  const ranked = Object.values(stats).sort((a, b) => b.titles - a.titles || b.wins - a.wins);

  if (ranked.length === 0) return (
    <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
      <div>Play tournaments to see leaderboard</div>
    </div>
  );

  return (
    <div>
      {ranked.map((p, i) => (
        <div key={p.name} className="glass-card" style={{ borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, background: i === 0 ? "rgba(241,200,53,0.06)" : undefined, border: i === 0 ? "1px solid rgba(241,200,53,0.2)" : undefined }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: i === 0 ? "var(--color-gold)" : i === 1 ? "var(--color-muted)" : "var(--color-muted)", width: 28, textAlign: "center" }}>
            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
          </div>
          <PlayerAvatar name={p.name} profile={p.avatar} size={32} expandable />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>{p.name}</div>
          </div>
          <div style={{ display: "flex", gap: 16, textAlign: "center" }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--color-gold)", lineHeight: 1 }}>{p.titles}</div>
              <div style={{ fontSize: 9, color: "var(--color-muted)", letterSpacing: 1 }}>TITLES</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--color-lime)", lineHeight: 1 }}>{p.wins}</div>
              <div style={{ fontSize: 9, color: "var(--color-muted)", letterSpacing: 1 }}>WINS</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--color-muted)", lineHeight: 1 }}>{p.losses}</div>
              <div style={{ fontSize: 9, color: "var(--color-muted)", letterSpacing: 1 }}>LOSS</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TournamentsTab({ tournaments, clubId, navigate, onOpenLive, isAdmin }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  // Sync all tournaments with Firebase Realtime DB:
  // - Completed without playerStats: backfill stats
  // - Live/unknown: check if champion was declared and update status
  useEffect(() => {
    tournaments.forEach(t => {
      if (!t.code) return;
      const needsBackfill = t.status === "completed" && !t.playerStats;
      const mightBeStale = t.status !== "completed"; // live or unknown
      if (!needsBackfill && !mightBeStale) return;

      get(ref(db, `tournaments/${t.code}`)).then(snap => {
        if (!snap.exists()) return;
        const fbData = snap.val();
        const rounds = fbData.rounds ? fbData.rounds.map(r => r ? Object.values(r) : []) : [];
        const entry = {
          ...t,
          rounds,
          playoffs: fbData.playoffs || null,
          champion: fbData.champion || t.champion || null,
          players: fbData.players || t.players || [],
        };
        // If FB shows champion but club doc still shows live — update it
        if (fbData.champion && t.status !== "completed") {
          saveTournamentToClub(clubId, entry);
          // Also update season
          import("../hooks/useClub").then(async ({ getActiveSeasonId, addTournamentToSeason }) => {
            const seasonId = await getActiveSeasonId(clubId);
            if (seasonId) addTournamentToSeason(clubId, seasonId, t.code, entry.players, fbData.champion);
          });
        } else if (needsBackfill) {
          saveTournamentToClub(clubId, entry);
        }
      }).catch(() => {});
    });
  }, [tournaments, clubId]);

  if (tournaments.length === 0) return (
    <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🏓</div>
      <div>No tournaments yet — create one from this club</div>
    </div>
  );
  return (
    <div>
      {tournaments.map(t => (
        <div key={t.code}>
          <div className="rh glass-card" style={{ borderRadius: 12, padding: "12px 14px", marginBottom: confirmDelete === t.code ? 0 : 8, cursor: "pointer", borderBottomLeftRadius: confirmDelete === t.code ? 0 : 12, borderBottomRightRadius: confirmDelete === t.code ? 0 : 12 }}
            onClick={() => {
              if (confirmDelete === t.code) return;
              if (t.status === "live" || t.status === "in-progress") {
                onOpenLive(t.code);
              } else {
                navigate("/history/detail", { state: { tournament: t } });
              }
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>{t.name || `#${t.code}`}</div>
                <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                  {t.date ? new Date(t.date).toLocaleDateString("en-IN", { dateStyle: "medium" }) : ""} · {t.playerCount} players
                </div>
                {t.champion && <div style={{ fontSize: 11, color: "var(--color-gold)", marginTop: 2 }}>🏆 {t.champion}</div>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: t.status === "completed" ? "rgba(16,212,142,0.12)" : "rgba(239,68,68,0.12)", color: t.status === "completed" ? "var(--color-lime)" : "var(--color-danger)" }}>
                {t.status === "completed" ? "DONE" : "LIVE"}
              </span>
              {isAdmin() && (
                <button onClick={e => { e.stopPropagation(); setConfirmDelete(confirmDelete === t.code ? null : t.code); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 2px", color: "var(--color-muted)", display: "flex", alignItems: "center" }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
          {confirmDelete === t.code && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {t.status === "completed" ? "Remove from club? (stats stay in player history)" : "Remove this live tournament from club?"}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmDelete(null)} style={{ background: "none", border: "1px solid var(--color-border)", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "var(--color-muted)" }}>Cancel</button>
                <button onClick={async () => { await removeTournamentFromClub(clubId, t.code); setConfirmDelete(null); }} style={{ background: "var(--color-danger)", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#fff", fontWeight: 700 }}>Remove</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SeasonTab({ seasons, clubId, isAdmin }) {
  const [creating, setCreating] = useState(false);
  const [seasonName, setSeasonName] = useState("");
  const [working, setWorking] = useState(false);

  const handleCreate = async () => {
    if (!seasonName.trim()) return;
    setWorking(true);
    await createSeason(clubId, seasonName.trim());
    setSeasonName(""); setCreating(false); setWorking(false);
  };

  const activeSeason = seasons.find(s => s.status === "active");
  const pastSeasons = seasons.filter(s => s.status === "completed");

  return (
    <div>
      {isAdmin() && !activeSeason && !creating && (
        <button className="pb" onClick={() => setCreating(true)}
          style={{ width: "100%", padding: 14, borderRadius: 12, border: "1px dashed var(--color-border)", background: "none", color: "var(--color-lime)", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Plus size={16} /> START NEW SEASON
        </button>
      )}

      {creating && (
        <div className="glass-card" style={{ borderRadius: 12, padding: "1rem", marginBottom: 16 }}>
          <input value={seasonName} onChange={e => setSeasonName(e.target.value)}
            placeholder="Season name (e.g. June 2026)"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--surface)", color: "var(--color-text)", fontSize: 14, marginBottom: 10, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pb" onClick={() => setCreating(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid var(--color-border)", background: "none", color: "var(--color-muted)", cursor: "pointer" }}>CANCEL</button>
            <button className="pb" onClick={handleCreate} disabled={working} style={{ flex: 2, padding: 10, borderRadius: 8, border: "none", background: "var(--color-lime)", color: "#0d0f0a", fontWeight: 700, cursor: "pointer" }}>
              {working ? "CREATING..." : "CREATE"}
            </button>
          </div>
        </div>
      )}

      {activeSeason && (
        <div className="glass-card" style={{ borderRadius: 14, padding: "1.2rem", marginBottom: 16, border: "1px solid rgba(16,212,142,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--color-lime)", letterSpacing: 2, fontWeight: 700 }}>🟢 ACTIVE SEASON</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--color-text)", letterSpacing: 1, marginTop: 2 }}>{activeSeason.name}</div>
            </div>
            {isAdmin() && (
              <button className="pb" onClick={() => endSeason(clubId, activeSeason.id)}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--color-danger)", background: "none", color: "var(--color-danger)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                END SEASON
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 12 }}>{(activeSeason.tournaments || []).length} tournaments played</div>
          {Object.keys(activeSeason.standings || {}).length > 0 && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--color-muted)", marginBottom: 8, fontWeight: 600 }}>STANDINGS</div>
              {Object.entries(activeSeason.standings)
                .sort((a, b) => b[1].points - a[1].points)
                .map(([name, s], i) => (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: i === 0 ? "var(--color-gold)" : "var(--color-muted)", width: 24 }}>{i + 1}</div>
                    <div style={{ flex: 1, fontSize: 13, color: "var(--color-text)", fontWeight: 500 }}>{name}</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--color-lime)" }}>{s.points} pts</div>
                    <div style={{ fontSize: 10, color: "var(--color-muted)" }}>{s.wins}W · {s.played} played</div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {pastSeasons.map(s => (
        <div key={s.id} className="glass-card" style={{ borderRadius: 12, padding: "1rem", marginBottom: 10, opacity: 0.7 }}>
          <div style={{ fontSize: 10, color: "var(--color-muted)", letterSpacing: 2, fontWeight: 600 }}>COMPLETED SEASON</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "var(--color-text)", marginTop: 2 }}>{s.name}</div>
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>{(s.tournaments || []).length} tournaments</div>
          {Object.keys(s.standings || {}).length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-gold)" }}>
              🏆 {Object.entries(s.standings).sort((a, b) => b[1].points - a[1].points)[0]?.[0]}
            </div>
          )}
        </div>
      ))}

      {seasons.length === 0 && !creating && (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏅</div>
          <div>No seasons yet — start one to track league standings</div>
        </div>
      )}
    </div>
  );
}

export function ClubDashboardScreen() {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const { club, members, pendingMembers, tournaments, seasons, loading, isAdmin } = useClubDetail(clubId);
  const memberProfiles = useClubMemberProfiles(members);
  const [tab, setTab] = useState("members");
  const [showInvite, setShowInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const inviteLink = club ? `${window.location.origin}${window.location.pathname}#/clubs?join=${club.code}` : "";

  const copyLink = () => {
    navigator.clipboard?.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(club?.code || "");
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`Join our club "${club.name}" on Pickleball Pro! 🏓\nTap to join: ${inviteLink}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };


  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)" }}>
      Loading club...
    </div>
  );

  if (!club) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)" }}>
      Club not found.
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-dark)", paddingBottom: "5rem" }}>
      {/* Header */}
      <div className="glass" style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ padding: "0 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, height: 60 }}>
            <button onClick={() => navigate("/clubs")} className="ni" style={{ background: "none", border: "none", color: "var(--color-muted)", display: "flex", alignItems: "center", cursor: "pointer" }}>
              <ArrowLeft size={22} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: club.themeColor || "var(--color-lime)", letterSpacing: 2, lineHeight: 1 }}>{club.name}</div>
              <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>{members.length} member{members.length !== 1 ? "s" : ""}</div>
            </div>
            <button className="pb" onClick={() => setShowInvite(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "none", color: "var(--color-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <Share2 size={12} /> INVITE
            </button>
            <button className="pb" onClick={shareWhatsApp}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "1px solid var(--color-border)", background: "none", cursor: "pointer", flexShrink: 0 }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" style={{ width: 18, height: 18 }} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 4, paddingBottom: 8 }}>
            {[
              { id: "members", label: "👥 MEMBERS" },
              { id: "leaderboard", label: "🏆 LEADERBOARD" },
              { id: "tournaments", label: "📅 MATCHES" },
              { id: "season", label: "🏅 SEASON" },
            ].map(t => (
              <button key={t.id} className={`tab-btn ${tab === t.id ? "on" : "off"}`} onClick={() => setTab(t.id)}
                style={{ flex: 1, position: "relative" }}>
                {t.label}
                {t.id === "members" && isAdmin() && pendingMembers.length > 0 && (
                  <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: "1rem 1rem", maxWidth: 600, margin: "0 auto" }}>
        {/* New tournament button */}
        {isAdmin() && (
          <button className="pb" onClick={() => navigate("/create", { state: { clubId, clubMembers: members } })}
            style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "var(--color-lime)", color: "#0d0f0a", fontWeight: 800, fontSize: 14, cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Plus size={16} /> NEW TOURNAMENT
          </button>
        )}

        {tab === "members" && <MembersTab members={members} pendingMembers={pendingMembers} club={club} isAdmin={isAdmin} clubId={clubId} navigate={navigate} memberProfiles={memberProfiles} />}
        {tab === "leaderboard" && <LeaderboardTab members={members} tournaments={tournaments} memberProfiles={memberProfiles} />}
        {tab === "tournaments" && <TournamentsTab tournaments={tournaments} clubId={clubId} navigate={navigate} onOpenLive={(code) => navigate(`/?join=${code}`)} isAdmin={isAdmin} />}
        {tab === "season" && <SeasonTab seasons={seasons} clubId={clubId} isAdmin={isAdmin} />}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div onClick={() => setShowInvite(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div onClick={e => e.stopPropagation()} className="glass-card fu" style={{ borderRadius: 20, padding: "2rem", width: "90%", maxWidth: 360, textAlign: "center", position: "relative" }}>
            <button onClick={() => setShowInvite(false)} className="pb" style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
              <X size={20} />
            </button>

            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, color: club.themeColor || "var(--color-lime)", marginBottom: 4 }}>INVITE TO CLUB</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>{club.name} · Scan QR or share the link</div>

            {/* QR Code — inline-block so it wraps to content */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 16, display: "inline-block", marginBottom: 20 }}>
              <QRCodeSVG value={inviteLink} size={180} fgColor="#0d0f0a" bgColor="#ffffff" />
            </div>

            {/* Club code display */}
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: "12px 20px", marginBottom: 20, border: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 2, marginBottom: 6 }}>CLUB CODE</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 6, color: club.themeColor || "var(--color-lime)" }}>{club.code}</div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button className="pb" onClick={copyLink} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: copiedLink ? "rgba(200,241,53,0.15)" : "var(--surface)", border: `1px solid ${copiedLink ? "var(--color-lime)" : "var(--color-border)"}`, borderRadius: 10, color: copiedLink ? "var(--color-lime)" : "var(--color-text)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <Copy size={14} /> {copiedLink ? "COPIED!" : "COPY LINK"}
              </button>
              <button className="pb" onClick={copyCode} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: copiedCode ? "rgba(200,241,53,0.15)" : "var(--surface)", border: `1px solid ${copiedCode ? "var(--color-lime)" : "var(--color-border)"}`, borderRadius: 10, color: copiedCode ? "var(--color-lime)" : "var(--color-text)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <Copy size={14} /> {copiedCode ? "COPIED!" : "COPY CODE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
