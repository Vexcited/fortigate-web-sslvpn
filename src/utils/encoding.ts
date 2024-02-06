/**
 * @remark Re-implementation of `fgt_string_encode`.
 */
export const encode = (str: string): string => {
  let output = "";

  for (let index = 0; index < str.length; ++index) {
    let char = str.charCodeAt(index).toString(16);

    if (char.length < 2) char = "0" + char;
    output += char;
  }

  return output;
};

/**
 * @remark Re-implementation of `fgt_string_decode`.
 */
export const decode = (str: string): string => {
  let output = "";

  for (let index = 0; index < str.length; index += 2) {
    output += String.fromCharCode(parseInt(str.substring(index, index + 2), 16));
  }

  return output;
};
