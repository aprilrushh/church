# 여의도순복음춘천교회 홈페이지

여의도순복음교회 직할성전 · Yoido Full Gospel Chuncheon Church

---

## 폴더 구조

```
church/
├── index.html          ← 홈페이지 메인 파일
├── images/
│   ├── 1.jpg           ← 교회 전경 사진
│   ├── 2.jpg           ← 성전 예배 모습 1
│   ├── 3.jpg           ← 성전 예배 모습 2
│   ├── 4.jpg           ← 초등부 예배 모습
│   ├── 5.jpg           ← 유치부 활동 모습
│   ├── 6.jpg           ← 새가족 환영 모습
│   └── 7.jpg           ← 박창호 담임목사 인물사진
└── README.md           ← 이 파일
```

---

## GitHub Pages 배포 방법

### 1단계: 폴더 준비 (내 PC에서)

```bash
C:\Users\andylee\church\
```

이 폴더 안에 아래처럼 파일을 배치하세요:

```
church/
├── index.html          ← church_homepage.html 파일을 index.html로 이름 변경
└── images/
    ├── 1.jpg
    ├── 2.jpg
    ├── 3.jpg
    ├── 4.jpg
    ├── 5.jpg
    ├── 6.jpg
    └── 7.jpg
```

> **중요!** `church_homepage.html` 파일 이름을 반드시 `index.html`로 바꿔주세요.

### 2단계: GitHub에 업로드

CMD(명령 프롬프트)를 열고 아래 명령어를 순서대로 실행:

```bash
cd C:\Users\andylee\church
git init
git add .
git commit -m "교회 홈페이지 첫 배포"
git branch -M main
git remote add origin https://github.com/aprilrushh/church.git
git push -u origin main
```

> 이미 git init을 하셨다면 `git init`과 `git remote add` 단계는 건너뛰세요.

### 3단계: GitHub Pages 활성화

1. https://github.com/aprilrushh/church 접속
2. **Settings** 탭 클릭
3. 왼쪽 메뉴에서 **Pages** 클릭
4. Source를 **Deploy from a branch** 선택
5. Branch를 **main** / **/ (root)** 선택 후 **Save**
6. 1~2분 후 사이트가 활성화됩니다

### 완료!

홈페이지 주소: **https://aprilrushh.github.io/church/**

---

## 사진 교체 방법

사진을 교체하고 싶으면 같은 파일명(1.jpg ~ 7.jpg)으로 `images/` 폴더에 덮어쓰기 후:

```bash
cd C:\Users\andylee\church
git add .
git commit -m "사진 업데이트"
git push
```

---

## 내용 수정 방법

`index.html` 파일을 메모장이나 VS Code로 열어서 텍스트를 수정한 후 동일하게 push하면 됩니다.

---

강원도 춘천시 동내면 동내로 17 | ☎ 033) 264-5111, 5116~7
