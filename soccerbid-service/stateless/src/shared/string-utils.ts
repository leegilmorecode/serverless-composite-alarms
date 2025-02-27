export function toPascalCase(input: string): string {
  return input
    .replace(
      /(\w)(\w*)/g,
      (_, firstLetter, rest) => firstLetter.toUpperCase() + rest.toLowerCase()
    )
    .replace(/\s+/g, '');
}

export function toKebabCase(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function objectToBase64(obj: any): string {
  const jsonString = JSON.stringify(obj);
  return btoa(jsonString);
}

export function base64ToObject<T>(base64: string): T {
  const jsonString = atob(base64);
  return JSON.parse(jsonString) as T;
}
