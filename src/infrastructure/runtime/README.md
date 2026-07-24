# Runtime-Adapter

Die Adapter implementieren die injizierbaren Runtime-Ports. Produktionsadapter
verwenden Systemzeit oder Node-Kryptografie nur hier; Fakes bleiben vollständig
steuerbar und reproduzierbar.

| Datei                    | Verantwortung                                   | Port                                                                   |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------- |
| [`clocks.ts`](clocks.ts) | System-, Fake- und pausierbare Kampagnenzeit    | [`application/runtime/clock.ts`](../../application/runtime/clock.ts)   |
| [`random.ts`](random.ts) | `xorshift32-v1`, Fake-Sequenzen und Kryptobytes | [`application/runtime/random.ts`](../../application/runtime/random.ts) |
| [`ids.ts`](ids.ts)       | Präfix-IDs mit Entropie und Fake-IDs            | [`application/runtime/ids.ts`](../../application/runtime/ids.ts)       |

## Simulations-PRNG

`xorshift32-v1` arbeitet intern ausschließlich mit einem unsigned 32-Bit-Zustand.
Der Kampagnen-Seed folgt jedoch dem REST-Vertrag und darf bis
`Number.MAX_SAFE_INTEGER` reichen; `foldSeedToUint32` faltet ihn deterministisch
auf 32 Bit (Seeds unter 2^32 bleiben dabei unverändert, sodass bestehende
Golden-Seed-Ergebnisse stabil bleiben). Das gefaltete Ergebnis wird zusammen mit
der Stream-ID zuerst über FNV-1a und einen festen 32-Bit-Finalizer gemischt.
Jeder Folgezustand berechnet dann exakt `x ^= x << 13`, `x ^= x >>> 17`,
`x ^= x << 5`; alle Schritte werden auf unsigned 32 Bit gekürzt. Bereichswerte
verwenden Rejection Sampling statt eines verzerrenden einfachen Modulo.
Algorithmuskennung, ungefalteter Seed, Stream-ID und Aufrufreihenfolge gehören
deshalb zum reproduzierbaren Simulationsinput.
