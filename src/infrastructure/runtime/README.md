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

`xorshift32-v1` arbeitet ausschließlich mit einem unsigned 32-Bit-Zustand.
Seed und Stream-ID werden zuerst deterministisch über FNV-1a und einen festen
32-Bit-Finalizer gemischt. Jeder Folgezustand berechnet dann exakt
`x ^= x << 13`, `x ^= x >>> 17`, `x ^= x << 5`; alle Schritte werden auf
unsigned 32 Bit gekürzt. Bereichswerte verwenden Rejection Sampling statt
eines verzerrenden einfachen Modulo. Algorithmuskennung, Seed, Stream-ID und
Aufrufreihenfolge gehören deshalb zum reproduzierbaren Simulationsinput.
