export default function readConstants(constantMap: any) {
  return Object.keys(constantMap).reduce(
    (acc: { [key: string]: any }, curr) => {
      if (typeof constantMap[curr] === "string") {
        let constMatch = constantMap[curr].match(/\{\+(.*)\+\}/);
        if (constMatch) {
          acc[curr] = replaceConstantsInString(constantMap[curr], constantMap);
        }
      } else {
        acc[curr] = constantMap[curr];
      }
      return acc;
    },
    {},
  );
}

function replaceConstantsInString(
  str: string,
  constants: { [key: string]: any },
): string {
  let constMatch = str.match(/\{\+(.*)\+\}/);
  if (!constMatch) {
    return str;
  }
  let startIndex = str.indexOf("{+");
  let endIndex = str.indexOf("+}") + "+}".length;
  return replaceConstantsInString(
    str.slice(0, startIndex) +
      constants[str.substring(startIndex + 2, endIndex - 2)] +
      str.slice(endIndex),
    constants,
  );
}
