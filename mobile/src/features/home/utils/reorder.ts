export function reorderExercises(exercises: any[], logsMap: any) {
  return [...exercises].sort((a, b) => {
    const aLogs = logsMap[a.id] || [];
    const bLogs = logsMap[b.id] || [];

    const aLast = aLogs[aLogs.length - 1]?.created_at || 0;
    const bLast = bLogs[bLogs.length - 1]?.created_at || 0;

    return (
      new Date(bLast).getTime() -
      new Date(aLast).getTime()
    );
  });
}
