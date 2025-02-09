.00 . u.01.02.0.19.00     Line 19 to Line 0 - Test not set
.01 . u.02.02.0.19.00     Line 19 to Line 0 - Test set
.02 .  .04.04.0.21.31     Execute Line 0 at T4

.04 . w.30.05.1.00.28     0.30 -> ARc   AR = A
.05 .  .07.07.0.08.31     Output AR to typewriter
.07 .  .07.07.0.28.31     While !IOReady GOTO 7

.08 . w.30.09.1.00.28     0.30 -> ARc   AR = A
.09 . w.31.10.2.00.29     0.31 -> AR+   AR += B
.10 . w.32.11.1.28.00     AR -> 00.32   C = A + B

.11 . w.31.12.1.00.28     AR = B
.12 . w.30.13.1.28.00     A = AR

.13 . w.32.14.1.00.28     AR = C
.14 . w.31.04.1.28.00     B = AR, GOTO 4

.30 1                     A
.31 1                     B
.32 0                     C