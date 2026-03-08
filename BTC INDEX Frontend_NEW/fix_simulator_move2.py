import sys

with open('src/components/Simulator.tsx', 'r') as f:
    lines = f.readlines()

# The user wants to:
# 1. Delete the "현재 시장 위치 메타데이터" section between "투자 기간" and "N년 뒤 예상 자산가치"
# 2. Move the "현재 시장 위치 메타데이터" and "유사 과거 패턴 레퍼런스" blocks (currently at the bottom) to be between "투자기간" and "N년 뒤 예상 자산 가치".
#
# Actually, the user says:
# "기존에 있던 투자기간 - n년 뒤 예상 자산가치 사이의 현재 시장 위치 메타데이터 칸 통째로 삭제.
# 제일 하단에 현재 시장위치 메타데이터 , 유사과거패턴 레퍼런스등의 박스를 통째로 투자기간 - n년 뒤 예상 자산가치 사이로 이동."

top_start = -1
for i, line in enumerate(lines):
    if '{/* 4. Similarity Analysis (Moved up from bottom) */}' in line:
        top_start = i
        break

top_end = -1
if top_start != -1:
    for i in range(top_start, len(lines)):
        if '{/* 2. Projection Cards - Now Grouped */}' in line:
            top_end = i
            break

# Now locate the bottom similarity block
bottom_start = -1
for i, line in enumerate(lines):
    if '{/* 4. Similarity Analysis */}' in line and '(Moved' not in line:
        bottom_start = i
        break

bottom_end = -1
if bottom_start != -1:
    for i in range(bottom_start, len(lines)):
        if '{/* Disclaimer */}' in line:
            bottom_end = i
            break

print(f"Top Block: {top_start} to {top_end}")
print(f"Bottom Block: {bottom_start} to {bottom_end}")

if top_start != -1 and top_end != -1 and bottom_start != -1 and bottom_end != -1:
    bottom_block = lines[bottom_start:bottom_end]
    
    # We delete the bottom block first from the bottom
    # Then we replace the top block with the bottom block
    
    del lines[bottom_start:bottom_end]
    lines[top_start:top_end] = bottom_block

    with open('src/components/Simulator.tsx', 'w') as f:
        f.writelines(lines)
    print("Successfully replaced and reordered.")
else:
    print("Could not find blocks reliably.")
