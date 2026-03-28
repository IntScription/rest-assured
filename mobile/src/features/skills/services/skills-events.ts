type Listener = () => void;

const challengeListeners = new Set<Listener>();
const dashboardListeners = new Set<Listener>();

export function emitSkillsDashboardChanged() {
  dashboardListeners.forEach((listener) => listener());
}

export function subscribeSkillsDashboardChanged(listener: Listener) {
  dashboardListeners.add(listener);
  return () => {
    dashboardListeners.delete(listener);
  };
}

export function emitSkillChallengesChanged() {
  challengeListeners.forEach((listener) => listener());
}

export function subscribeSkillChallengesChanged(listener: Listener) {
  challengeListeners.add(listener);
  return () => {
    challengeListeners.delete(listener);
  };
}
