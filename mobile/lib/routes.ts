import { Href } from 'expo-router';

export function recordHref(id: number): Href {
  return `/record/${id}` as Href;
}

export function customerHref(id: number): Href {
  return `/customer/${id}` as Href;
}
