# 늑대와 양 게임 — 성능 유지보수 가이드라인

1~3단계 최적화 작업 후 남기는 규칙입니다. 새 방/소품/연출을 추가할 때 이 문서를
먼저 확인하세요. 원인 진단과 각 단계 작업 내용은 `PERF_BASELINE.md`와
`MainScene.ts`/`RoomDecor.ts`/`BeanCharacter.ts` 상단 주석을 참고하세요.

## 1. 정적 요소는 반드시 베이킹 단계에 추가할 것

방 바닥, 복도 스트라이프, 벽 bevel, 소품, 문 표시, 고정 라벨처럼 **게임 중 절대
바뀌지 않는 시각 요소**는 전부 `RoomDecor.ts`의 `bakeStaticMap()` 안에서
`RenderTexture`에 한 번만 그려야 합니다.

- 새 소품을 추가한다 → `bakeStaticMap()`의 `extraDraw` 콜백이나 소품 그리기
  로직에 추가한다. 별도 `this.add.image()` / `this.add.graphics()`로 씬에
  라이브 오브젝트를 만들지 않는다.
- 새 방/복도를 추가한다 → `types.ts`의 `ROOMS`/`HALLWAYS` 데이터에 추가하면
  `bakeStaticMap()`이 알아서 굽는다. 별도 렌더링 코드를 새로 짤 필요 없음.

## 2. 게임 중 라이브 마스크 오브젝트 추가 금지

`GeometryMask` / `BitmapMask`는 모바일 GPU에서 스텐실 버퍼 전환 비용이 커서
2단계에서 전부 제거했습니다. 새 기능에서 "특정 모양으로만 보이게" 하고 싶다면:

- 정적인 모양이면 → 베이킹 단계에서 마스크를 **한 번만** 적용해 텍스처에 굽는다
  (`bakeStaticMap` 내부 패턴 참고).
- 매 프레임 바뀌어야 하면(예: 안개) → 마스크 대신 `RenderTexture.erase()` 방식을
  검토한다 (`MainScene.updateFogOfWar()` 참고). 정말 필요할 때만, 그리고 비용을
  먼저 측정하고 도입한다.

## 3. 새 라이브 Text 오브젝트는 최소화

플레이어 이름표, `promptText`, 도어락 라벨처럼 **동적으로 내용이 바뀌는 것만**
라이브 `Text`로 만듭니다. 고정 텍스트(방 이름, 안내판 등)는 베이킹 단계에
포함시키세요. Phaser `Text`는 오브젝트마다 개별 캔버스 텍스처라 배칭이 안 되고
생성 비용도 큽니다.

## 4. 화면 밖(카메라 뷰포트 밖) 오브젝트는 갱신을 줄일 것

3단계에서 도입한 패턴(`MainScene.isNearViewport()` 참고)을 새 캐릭터/오브젝트
로직에도 그대로 적용하세요:

- 뷰포트 진입/이탈 "순간"에만 `setVisible()` 토글 + 관련 트윈 pause/resume
  (`BeanCharacter.setBeanVisualActive()`). **매 프레임** 호출하면 컬링의 의미가
  없으니 상태가 실제로 바뀔 때만 처리한다.
- 위치 보간처럼 "완전히 멈추면 어색한" 갱신은 완전히 끄지 말고 빈도만 낮춘다
  (예: 3~5프레임에 1번).
- 텍스처 스왑(걷기 애니메이션 등)처럼 "안 보이면 의미가 없는" 갱신은 화면 밖일
  때 완전히 생략해도 된다.

## 5. 저사양 기기 분기 (`lowSpecMode`)

`perfTier.ts`가 판정 로직을 담당합니다.

- 1차: `create()` 시작 시 기기 스펙(`hardwareConcurrency`, `devicePixelRatio`) +
  WebGL 지원 여부(Canvas 폴백 시 강제 저사양)로 즉시 판정.
- 2차: 실제 플레이 5초간 FPS 평균이 40 미만이면 저사양으로 **강등만** 한다
  (승급은 하지 않음 — 왕복하면 체감이 더 이상해진다).
- 테스트: 주소에 `?lowspec=1` / `?highspec=1`을 붙이면 강제 지정된다.

새 연출을 추가할 때 "체감 효과는 적은데 비용이 큰" 디테일(카메라 shake, 파티클
개수, 미세 스케일 애니메이션 등)이 있다면 `this.lowSpecMode` 분기를 추가해서
저사양 기기에서는 생략/축소하는 옵션을 넣어주세요. `BeanCharacter.spawnKillPoof()`
의 `particleCount`/`skipShake` 옵션, `applyWalkAnim()`의 `skipBreathe` 옵션이
참고할 패턴입니다.

## 6. 물리(Arcade Physics) 설정은 근거 없이 바꾸지 않는다

정적 벽 바디 개수가 많지만, 3단계 시점에는 이게 실제 병목이라는 측정 근거가
없었습니다. `physics.world.fps`나 `fixedStep`을 렌더링과 분리해 물리 스텝을
낮추는 건 캐릭터 이동감에 직접 영향을 주므로, **DevTools Performance 탭에서
"Script"(물리 계산) 비중이 실제로 높게 나올 때만**, 그리고 이동감 저하를
감수할 수 있는지 확인한 뒤에 시도하세요. `PERF_BASELINE.md`에 측정치를 먼저
남기고 나서 변경하는 걸 원칙으로 합니다.

## 7. 렌더러 폴백(Canvas)에 대한 태도

`type: Phaser.AUTO`는 WebGL 미지원 기기에서 Canvas로 자동 폴백됩니다. Canvas는
이 프로젝트 구조(다수의 이미지/컨테이너, 파티클)에서 배칭이 거의 안 돼 훨씬
느립니다. `MainScene.create()`가 `this.game.renderer.type === Phaser.CANVAS`를
감지하면 자동으로 저사양 모드를 강제하므로, 새 기능을 짤 때 "이 기기는 WebGL을
쓰겠지"라고 가정하지 말고 `lowSpecMode` 분기를 존중하세요.

## 8. 새 기능을 넣기 전 체크리스트

- [ ] 정적 요소인가? → 베이킹 단계(`bakeStaticMap`)에 넣었는가?
- [ ] 마스크가 꼭 필요한가? → 정적이면 베이킹 시 한 번만, 동적이면 대안(RenderTexture
      erase 등)을 먼저 검토했는가?
- [ ] 매 프레임 갱신되는 새 오브젝트가 많은 인원 수만큼 늘어나는가(캐릭터당 N개)?
      → 화면 밖 컬링 패턴을 적용했는가?
- [ ] 체감 효과 대비 비용이 큰 디테일 연출인가? → `lowSpecMode` 분기를 넣었는가?
- [ ] 변경 후 `?lowspec=1`로도 한 번 플레이해봤는가?