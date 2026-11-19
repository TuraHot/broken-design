// A gallery tag in the visitor's language. The gallery tags have a text in messages/discover.ts; a tag a creator typed
// that is not one of them is shown exactly as written.
import { MESSAGES, type MessageKey } from './messages';

export function tagLabel(t: (key: MessageKey) => string, tag: string): string {
  const key = `tag.${tag.toLowerCase()}`;
  return key in MESSAGES.en ? t(key as MessageKey) : tag;
}
