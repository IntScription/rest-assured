import { StyleSheet } from "react-native";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./constants";

export const styles = StyleSheet.create({
  container: { flex: 1 },
  flexFill: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 22,
  },
  emptyCta: { marginTop: 12 },
  emptyCtaText: { color: "#3B82F6", fontSize: 16, fontWeight: "700" },

  tourBannerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  pageContainer: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 16,
  },

  topCard: { padding: 20, borderRadius: 22, marginVertical: 12, borderWidth: 1 },
  splitTitle: { fontSize: 22, fontWeight: "600" },
  focus: { marginTop: 4, fontSize: 13 },

  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  primaryButton: { padding: 12, borderRadius: 14, flex: 1, alignItems: "center" },
  primaryText: { fontWeight: "700" },
  secondaryButton: { padding: 12, borderRadius: 14, flex: 1, alignItems: "center" },
  secondaryText: { fontWeight: "700" },
  disabledButton: { opacity: 0.55 },

  dotsRow: { flexDirection: "row", gap: 6, marginTop: 14 },
  dot: { width: 9, height: 9, borderRadius: 999 },

  exerciseCardWrapper: {
    flex: 1,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 220,
  },
  exerciseEmpty: { flex: 1, padding: 16, alignItems: "center", justifyContent: "center" },
  exerciseEmptyText: { fontSize: 14 },

  exerciseCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    width: "100%",
  },
  exerciseRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 40 },
  exercisePressArea: { flex: 1, justifyContent: "center" },
  exerciseText: { fontSize: 16, fontWeight: "600", letterSpacing: 0.2 },
  latestLogText: { marginTop: 4, fontSize: 12, fontWeight: "500" },

  iconRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  iconButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },

  exerciseInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 2,
    borderBottomWidth: 1,
  },

  homeScrollContent: {
    paddingBottom: 28,
  },
  carouselStage: {
    height: 720,
  },
  bottomSectionsWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 14,
  },
  bottomSection: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  bottomSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  bottomIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomTitleWrap: {
    flex: 1,
  },
  bottomSectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  bottomSectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
  },
  bottomEmptyText: {
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 4,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: 1,
  },
  activityMain: {
    flex: 1,
    minWidth: 0,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  activityMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "500",
  },
  activityDate: {
    fontSize: 11,
    fontWeight: "700",
  },
  noteCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toneDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  noteTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  noteBody: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  prRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  prBadge: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F97316",
  },
  prBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  attentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: 1,
  },
});
