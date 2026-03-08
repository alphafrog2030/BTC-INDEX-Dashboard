import sys

with open('src/components/Simulator.tsx', 'r') as f:
    lines = f.readlines()

# find exact index for "4. Similarity Analysis (Moved up from bottom)"
top_idx = -1
for i, line in enumerate(lines):
    if "4. Similarity Analysis (Moved up from bottom)" in line:
        top_idx = i
        break

bottom_idx = -1
for i, line in enumerate(lines):
    if "4. Similarity Analysis" in line and "Moved up from bottom" not in line:
        bottom_idx = i
        break

print(f"Top idx: {top_idx}, Bottom idx: {bottom_idx}")

# The top block ends with the second `</div>` at that indentation level.
# The bottom block ends right before Disclaimer

