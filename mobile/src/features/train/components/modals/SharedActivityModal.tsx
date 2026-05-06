import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";

import FancyModalShell from "../FancyModalShell";
import { EmptyStateCard } from "../SectionShell";
import type { ThemeType } from "../../types";

function formatRelativeTimestamp(value: string | null) {
  if (!value) return "";

  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return "";

  const diff = Date.now() - ms;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m ago`;
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))}h ago`;
  if (diff < 7 * day) return `${Math.max(1, Math.floor(diff / day))}d ago`;

  return new Date(value).toLocaleDateString();
}

function getStatusTone(status: string, t: ThemeType) {
  if (status === "accepted") {
    return {
      bg: "rgba(48,209,88,0.12)",
      border: "rgba(48,209,88,0.28)",
      text: "#30d158",
    };
  }

  if (status === "declined") {
    return {
      bg: "rgba(255,69,58,0.12)",
      border: "rgba(255,69,58,0.28)",
      text: "#ff453a",
    };
  }

  return {
    bg: t.cardAlt,
    border: t.border,
    text: t.text,
  };
}

function usernameLabel(value?: string | null) {
  const clean = value?.trim();
  return clean ? `@${clean}` : "Username unavailable";
}

type Props = {
  visible: boolean;
  onClose: () => void;
  pendingShares: any[];
  sentShares: any[];
  recentImports: any[];
  t: ThemeType;
  handleAcceptShare: (shareId: string) => void;
  handleDeclineShare: (shareId: string) => void;
};

export function SharedActivityModal({
  visible,
  onClose,
  pendingShares,
  sentShares,
  recentImports,
  t,
  handleAcceptShare,
  handleDeclineShare,
}: Props) {
  const { height } = useWindowDimensions();
  const scrollMaxHeight = Math.round(height * 0.5);

  return (
    <FancyModalShell
      visible={visible}
      onClose={onClose}
      title="Shared activity"
      subtitle="Requests, sent shares, and imports."
      t={t}
      enableSwipeDismiss
      swipeDismissArea="sheet"
      showCloseButton={false}
      sheetMaxHeight="72%"
      contentStyle={styles.content}
    >
      <ScrollView
        style={{ maxHeight: scrollMaxHeight }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        contentContainerStyle={styles.scrollContent}
      >
        {pendingShares.length > 0 ? (
          <>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Needs your action</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingShares.length}</Text>
              </View>
            </View>

            <View style={styles.cardStack}>
              {pendingShares.map((share) => (
                <View
                  key={share.id}
                  style={[styles.activityCard, { borderColor: t.border, backgroundColor: t.cardAlt }]}
                >
                  <Text style={[styles.cardTitle, { color: t.text }]}>
                    {share.program_name ?? share.program_name_snapshot ?? "Shared program"}
                  </Text>

                  <Text style={[styles.cardMeta, { color: t.mutedText }]}>
                    From {usernameLabel(share.sender_username ?? share.shared_by_username_snapshot)}
                  </Text>

                  {share.created_at ? (
                    <Text style={[styles.cardDate, { color: t.mutedText }]}>
                      {formatRelativeTimestamp(share.created_at)}
                    </Text>
                  ) : null}

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => handleAcceptShare(share.id)}
                      activeOpacity={0.88}
                      style={[styles.actionButton, { backgroundColor: "#30d158" }]}
                    >
                      <Text style={styles.actionButtonTextLight}>Accept</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeclineShare(share.id)}
                      activeOpacity={0.88}
                      style={[
                        styles.actionButton,
                        {
                          backgroundColor: t.cardAlt,
                          borderWidth: 1,
                          borderColor: t.border,
                        },
                      ]}
                    >
                      <Text style={[styles.actionButtonTextDark, { color: t.text }]}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text
          style={[
            styles.sectionTitle,
            {
              color: t.text,
              marginTop: pendingShares.length > 0 ? 2 : 0,
              marginBottom: 10,
            },
          ]}
        >
          Recent sent
        </Text>

        {sentShares.length === 0 ? (
          <EmptyStateCard
            icon="share-outline"
            title="Nothing shared yet"
            message="Programs you share will appear here."
            t={t}
          />
        ) : (
          <View style={styles.cardStack}>
            {sentShares.map((share) => {
              const tone = getStatusTone(share.status, t);
              const receiver =
                share.receiver_username ??
                share.shared_with_username ??
                share.shared_with_username_snapshot ??
                null;

              return (
                <View
                  key={share.id}
                  style={[styles.activityCard, { borderColor: tone.border, backgroundColor: tone.bg }]}
                >
                  <Text style={[styles.cardTitle, { color: t.text }]}>
                    {share.program_name ?? share.program_name_snapshot ?? "Shared program"}
                  </Text>

                  <Text style={[styles.cardMeta, { color: t.mutedText }]}>
                    With {usernameLabel(receiver)}
                  </Text>

                  <View style={styles.statusRow}>
                    <Text style={[styles.statusText, { color: tone.text }]}>
                      {share.status ?? "pending"}
                    </Text>

                    {share.created_at ? (
                      <Text style={[styles.cardDate, { color: t.mutedText }]}>
                        {formatRelativeTimestamp(share.created_at)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: t.text, marginTop: 16, marginBottom: 10 }]}>
          Recent imports
        </Text>

        {recentImports.length === 0 ? (
          <EmptyStateCard
            icon="download-outline"
            title="No imports yet"
            message="Accepted programs will appear here."
            t={t}
          />
        ) : (
          <View style={styles.cardStack}>
            {recentImports.map((item) => (
              <View
                key={item.id}
                style={[styles.activityCard, { borderColor: t.border, backgroundColor: t.cardAlt }]}
              >
                <Text style={[styles.cardTitle, { color: t.text }]}>
                  {item.program_name ?? "Imported program"}
                </Text>

                <Text style={[styles.cardMeta, { color: t.mutedText }]}>
                  From {usernameLabel(item.shared_by_username)}
                </Text>

                {item.created_at ? (
                  <Text style={[styles.cardDate, { color: t.mutedText }]}>
                    {formatRelativeTimestamp(item.created_at)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </FancyModalShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: "900",
    fontSize: 15,
  },
  pendingBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff453a",
  },
  pendingBadgeText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 11,
  },
  cardStack: {
    gap: 9,
    marginBottom: 16,
  },
  activityCard: {
    borderWidth: 1,
    borderRadius: 17,
    padding: 12,
  },
  cardTitle: {
    fontWeight: "900",
    fontSize: 14.5,
  },
  cardMeta: {
    marginTop: 4,
    fontWeight: "700",
    lineHeight: 18,
    fontSize: 13,
  },
  cardDate: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 7,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 14,
  },
  actionButtonTextLight: {
    color: "#fff",
    fontWeight: "900",
  },
  actionButtonTextDark: {
    fontWeight: "900",
  },
  statusText: {
    fontWeight: "800",
    textTransform: "capitalize",
  },
});
