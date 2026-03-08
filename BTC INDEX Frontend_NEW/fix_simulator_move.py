import sys

with open('src/components/Simulator.tsx', 'r') as f:
    lines = f.readlines()

# 1. Look for the top block that is currently sitting between '투자 기간' and '예상 자산 가치'
top_start = -1
top_end = -1
for i, line in enumerate(lines):
    if '{/* 4. Similarity Analysis (Moved up from bottom) */}' in line:
        top_start = i
        break

if top_start != -1:
    for i in range(top_start, len(lines)):
        if '{/* 2. Projection Cards - Now Grouped */}' in line:
            top_end = i
            break

# 2. Look for the real bottom block that has all the right contents
bottom_start = -1
bottom_end = -1
for i, line in enumerate(lines):
    if '{/* 4. Similarity Analysis */}' in line and '(Moved' not in line:
        bottom_start = i
        break

if bottom_start != -1:
    for i in range(bottom_start, len(lines)):
        if '{/* Disclaimer */}' in line:
            bottom_end = i
            break

print(f"Top Block: {top_start} to {top_end}")
print(f"Bottom Block: {bottom_start} to {bottom_end}")

if top_start != -1 and top_end != -1 and bottom_start != -1 and bottom_end != -1:
    real_block = lines[bottom_start:bottom_end]
    # delete bottom block
    del lines[bottom_start:bottom_end]
    # replace top block
    lines[top_start:top_end] = real_block

    with open('src/components/Simulator.tsx', 'w') as f:
        f.writelines(lines)
    print("Successfully replaced and reordered.")
else:
    print("Could not find the blocks reliably.")
