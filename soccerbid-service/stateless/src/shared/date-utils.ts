export const getISOString = (): string => {
  return new Date().toISOString();
};

export const getCurrentEpochTime = (): number => {
  return Math.floor(Date.now() / 1000);
};
