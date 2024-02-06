import type { FileData } from "../classes/File";

const readNetworkFiles = (raw: string): Array<FileData> => {
  const stringIndex = raw.indexOf("var s = ") + 9;
  const stringEndIndex = raw.indexOf("fgt_data = ", stringIndex) - 3;
  const rawJSON = raw.slice(stringIndex, stringEndIndex);
  return JSON.parse(rawJSON);
};

export default readNetworkFiles;
