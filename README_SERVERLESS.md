# 🌐 비트코인 대시보드: "0원 아키텍처" 가이드

축하합니다! 이제 서버 비용이 전혀 들지 않는 **완전 자동화된 대시보드 시스템**이 구축되었습니다.

## 🛠️ 시스템 구조 (Serverless Architecture)
1.  **데이터 수집 (내 컴퓨터)**: 컴퓨터를 켤 때마다 자동으로 파이썬 스크립트가 실행되어 데이터를 수집합니다.
    -   크롬 브라우저는 **화면 밖(Off-screen)에서 몰래 실행**되므로 작업에 방해되지 않습니다.
2.  **데이터 저장 (GitHub)**: 수집된 데이터는 자동으로 `data.json` 파일로 저장되어 GitHub에 업로드됩니다.
3.  **웹사이트 (Frontend)**: 전 세계 어디서든 GitHub에 올라간 최신 데이터를 받아와 화면에 보여줍니다.

---

## 🚀 설정 방법 (최초 1회)

### 1단계: GitHub 저장소 만들기
1.  [GitHub](https://github.com/)에 로그인하고 **New Repository**를 만듭니다 (Public/Private 상관없음).
2.  **생성된 저장소 주소(URL)**를 복사합니다. (예: `https://github.com/아이디/레포지토리이름.git`)
3.  **Visual Studio Code 터미널**에 아래 명령어를 입력하여 업로드합니다.
    (이미 로컬 저장소 초기화는 완료되었습니다!)

    ```powershell
    # 본인의 주소로 변경해서 입력하세요
    git remote add origin https://github.com/아이디/레포지토리이름.git
    git branch -M main
    git push -u origin main
    ```

### 2단계: 프론트엔드 주소 연결
1.  GitHub에 파일이 올라갔다면, `data.json` 파일을 찾아 클릭합니다.
2.  **[Raw]** 버튼을 눌러 주소를 복사합니다. (예: `https://raw.githubusercontent.com/.../main/data.json`)
3.  `BTC INDEX Frontend/services/marketService.ts` 파일을 열고 `API_URL` 변수에 붙여넣습니다.
4.  변경사항을 다시 GitHub에 푸시합니다.
    ```powershell
    git add .
    git commit -m "Update API URL"
    git push
    ```

### 3단계: 자동 실행 등록
1.  **`register_startup.ps1`** 파일을 우클릭하여 **'PowerShell에서 실행'**을 누릅니다.
2.  "성공: 작업이 스케줄러에 등록되었습니다" 메시지가 뜨면 끝입니다.

---

## ✨ 사용 방법
이제 아무것도 하실 필요가 없습니다.
-   **평소처럼 컴퓨터를 켜고 사용하시면 됩니다.**
-   로그인 시 백그라운드에서 데이터가 갱신되어 GitHub로 전송됩니다.
-   대시보드 웹사이트에 접속하면 언제나 최신(오늘 킨 시점) 데이터를 볼 수 있습니다.

## ❓ 자주 묻는 질문
-   **Q: 브라우저가 안 보여요?**
    -   A: 정상입니다! 방해되지 않도록 화면 밖 좌표(-32000, -32000)에서 실행되도록 설정했습니다.
-   **Q: 데이터가 안 바뀌어요?**
    -   A: GitHub 캐시로 인해 반영까지 1~5분 정도 걸릴 수 있습니다.
-   **Q: 수동으로 업데이트하고 싶어요?**
    -   A: `run_update.ps1` 파일을 더블클릭 하시면 즉시 업데이트됩니다.
