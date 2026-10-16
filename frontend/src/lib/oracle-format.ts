const numbers = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const dates = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export const formatOracleNumber = (value: number) => numbers.format(value);
export const formatOracleDate = (value: string) =>
  `${dates.format(new Date(value))} WIB`;
