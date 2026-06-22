export const isPastEvent = (date: string) => new Date(date).getTime() < Date.now();
