#Copy loaded program from 19 -> 0 and begin execution at 0:04
.00 . u.01.02.0.19.00     Line 19 to Line 0 - Test not set
.01 . u.02.02.0.19.00     Line 19 to Line 0 - Test set
.02 .  .04.04.0.21.31     Execute Line 0 at T4

#Print value A to typewriter
.04 .  .30.05.1.00.28     0.30 -> ARc   AR = A
.05 .  .07.07.0.08.31     Output AR to typewriter
.07 .  .07.07.0.28.31     While !IOReady GOTO 7

# C = A + B
.08 .  .30.09.1.00.28     0.30 -> ARc   AR = A
.09 .  .31.10.2.00.29     0.31 -> AR+   AR += B
.10 .  .32.11.1.28.00     AR -> 00.32   C = A + B

# A = B
.11 .  .31.12.1.00.28     AR = B
.12 .  .30.13.1.28.00     A = AR

# B = C
# GOTO :04
.13 .  .32.14.1.00.28     AR = C
.14 .  .31.04.1.28.00     B = AR, GOTO 4

# Variables
.30 1                     A
.31 1                     B
.32 0                     C