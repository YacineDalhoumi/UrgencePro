// Transforme dist/index.html (document complet) en fragment publiable comme Artifact :
// la plateforme ajoute elle-même doctype, <html>, <head> et <body>.
import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
const pick = (re) => [...html.matchAll(re)].map((m) => m[0])
const title = pick(/<title>[\s\S]*?<\/title>/g)
const links = pick(/<link\b[^>]*>/g)
const styles = pick(/<style\b[^>]*>[\s\S]*?<\/style>/g)
const scripts = pick(/<script\b[^>]*>[\s\S]*?<\/script>/g)
const out = [...title, ...links, ...styles, '<div id="root"></div>', ...scripts].join('\n')
writeFileSync(new URL('../dist/urgencepro-demo.html', import.meta.url), out)
console.log(`dist/urgencepro-demo.html : ${(out.length / 1024).toFixed(0)} Ko`)
