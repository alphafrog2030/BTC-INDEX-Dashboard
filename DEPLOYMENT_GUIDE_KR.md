# 비트코인 온체인 대시보드 배포 가이드 (Deployment Guide)

이 프로젝트는 **웹 크롤러(Chrome 브라우저 필요)**가 포함되어 있어, 일반적인 서버리스(Vercel, AWS Lambda 등) 환경에서는 작동이 어렵습니다.
가장 확실하고 간편한 방법은 **가상 서버(VPS)**를 하나 임대하여 내 컴퓨터처럼 켜두는 것입니다.

추천 서비스: **AWS Lightsail**, **Vultr**, **Linode**, **Oracle Cloud (Free Tier)**

---

## 1. 사전 준비 (설정 변경)

서버에 올리기 전에 딱 한 줄을 변경해야 합니다. 프론트엔드가 더 이상 내 컴퓨터(localhost)가 아닌, 서버의 주소를 바라봐야 하기 때문입니다.

### [수정 대상] `BTC INDEX Frontend/services/marketService.ts`
```typescript
// 변경 전
const API_URL = "http://localhost:8000/api/raw-data";

// 변경 후 (서버 IP가 123.45.67.89 라고 가정시)
const API_URL = "http://123.45.67.89:8000/api/raw-data";
```
> **팁:** 나중에 이 부분을 `.env` 환경변수로 분리하면 코드 수정 없이 관리할 수 있습니다.

---

## 2. 서버 구축 절차 (Ubuntu 리눅스 기준)

### 단계 1: 서버 대여 (VPS)
1. 클라우드 제공사(AWS, Vultr, Oracle 등)에서 **Ubuntu 22.04 LTS** 서버를 생성합니다.
   - **팁 (초보자용)**: **윈도우 서버(Windows Server)** 를 빌리면 내 컴퓨터처럼 똑같이 마우스로 클릭해서 설치할 수 있어서 훨씬 편합니다. (AWS EC2 Windows t3.medium 추천)
2. 최소 사양: **2GB RAM** 이상 (크롬 브라우저 구동을 위해 필요)
3. **방화벽(Security Group) 설정**:
   - `8000` 포트 (백엔드): Anywhere (0.0.0.0/0) 허용
   - `5173` 포트 (프론트엔드 개발서버용): Anywhere 허용 (또는 80/443으로 배포)

### 단계 2: 필수 프로그램 설치 (리눅스 기준)
서버 터미널(SSH)에 접속하여 아래 명령어를 한 줄씩 입력하세요.

```bash
# 1. 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 2. Python 및 pip 설치
sudo apt install python3-pip python3-venv -y

# 3. Node.js (v18+) 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Chrome 브라우저 설치 (크롤링용)
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install ./google-chrome-stable_current_amd64.deb -y
```

### 단계 3: 프로젝트 업로드
**FileZilla** 같은 프로그램을 이용해 `BTC onchain index` 폴더 전체를 서버의 `/home/ubuntu/` 경로에 업로드합니다.

### 단계 4: 백엔드 실행 (백그라운드)
```bash
cd "/home/ubuntu/BTC onchain index/BTC INDEX Backend"

# 가상환경 생성 및 패키지 설치
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install selenium undetected-chromedriver fastapi uvicorn requests pandas yfinance

# 서버 실행 (백그라운드 유지: nohup 사용)
nohup uvicorn "bitcoin onchain Backend":app --host 0.0.0.0 --port 8000 &
```
> 이제 `http://서버IP:8000/api/raw-data` 로 접속해서 데이터가 나오는지 확인해보세요.

### 단계 5: 프론트엔드 실행
개발 모드(`npm run dev`)로 띄우거나, 정식 빌드(`npm run build`)하여 실행할 수 있습니다.

**방법 A: 간편 실행 (Dev Mode)**
```bash
cd "/home/ubuntu/BTC onchain index/BTC INDEX Frontend"
npm install

# 외부 접속 허용하며 실행
nohup npm run dev -- --host 0.0.0.0 &
```
이제 `http://서버IP:5173` 으로 접속하면 대시보드가 보입니다!

---

## 3. 주의사항 (크롤링 이슈)
**[업데이트 완료]** 이제 백엔드 코드(`bitcoin onchain Backend.py`)에 리눅스/Headless 모드를 위한 최적화 옵션(`--headless=new`, `--no-sandbox` 등)이 모두 적용되었습니다.
따라서 별도의 코드 수정 없이 위 가이드대로 실행하시면 작동할 가능성이 높습니다.
만약 그래도 브라우저 실행 실패시, `google-chrome` 설치 여부를 다시 확인해주세요.

여전히 설정이 어렵다면, **윈도우 서버(Windows Server)** 를 사용하는 것이 가장 추천되는 방법입니다.
