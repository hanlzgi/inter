document.title = "대취타"; // 제목

$(function () {
  // bgm
  var bgm = $("#bgm")[0];
  if (bgm) {
    var file = bgm.src;
    bgm.play();
    if (!bgm.paused) {
      console.log(file); //재생되는 파일 확인
    }
  }

  var activeBgm = $("#active")[0];
  if (activeBgm) {
    var file = activeBgm.src;
    
    activeBgm.onended = function() {
      $(".slider-wrap").addClass("active")
    };
    
    // BGM 재생 시작
    activeBgm.play();
  }

  var effect = $("#effect")[0];
  if (effect) {
    effect.play();
  }

  document.querySelectorAll("img").forEach(function (img) {
    img.setAttribute("aria-hidden", "true");
    img.setAttribute("alt", "");
  });

  // 버튼
  var btnEffect = new Audio("./sound/effect/button.mp3");
  $(".btn-effect").on("mouseover", function () {
    btnEffect.play();
  });

  $(".btn-effect").on("click", function () {
    btnEffect.play();
  });

  //  셀렉트
  $(".btn-select").on("mouseover", function () {
    var btnIdx = $(".btn-select").index(this);

    $(".audio_wrap audio").each(function () {
      this.pause();
      this.currentTime = 0;
    });

    $(".audio_wrap audio").eq(btnIdx)[0].play();
  });

  $(".btn-select").on("mouseout", function () {
    $(".audio_wrap audio").currentTime = 0;
  });

  // 스타트 버튼
  const btnstart = new Audio("./sound/narration/home_01.mp3");
  const btnstart2 = new Audio("./sound/narration/home_02.mp3");
  $(".btn-start").on("mouseover", function () {
    btnstart.play();
    btnstart2.play();
  });

  // 첫번째 컨텐츠
  // 슬라이드
  const sliderWrap = document.querySelector(".slider-wrap");
if (sliderWrap) {
  const slideWidth = document.querySelector(".box").offsetWidth + 20; // 슬라이드 너비와 간격
  const slideCount = document.querySelectorAll(".box").length;
  const visibleSlides = 4; // 한 번에 보이는 슬라이드 수

  let currentSlide = 0;

  function updateSlides() {
    const boxes = document.querySelectorAll(".box");
    boxes.forEach((box, index) => {
      if (index >= currentSlide && index < currentSlide + visibleSlides) {
        box.style.display = "flex"; // 보여주기
      } else {
        box.style.display = "none"; // 숨기기
      }
    });
    // 슬라이더의 스크롤 위치 조정
    sliderWrap.scrollTo({
      left: currentSlide * slideWidth,
      behavior: "smooth",
    });
  }

  $(".next").click(function () {
    if (currentSlide < slideCount - visibleSlides) {
      currentSlide++;
      updateSlides();
    }
  });

  $(".prev").click(function () {
    if (currentSlide > 0) {
      currentSlide--;
      updateSlides();
    }
  });

  // 초기 슬라이드 상태 업데이트
  if ($(".slide").length > 0) {
    updateSlides();
  }

  // 악기 랜덤 배치
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]]; // 요소 교환
    }
  }

  // 박스 요소들을 랜덤으로 배치
  function randomizeBoxes() {
    var $boxContainer = $(".sd");
    var $boxes = $boxContainer.children(".box").get(); // .box 요소를 배열로 변환

    shuffleArray($boxes); // 배열을 랜덤으로 섞기

    // 섞인 배열로 DOM을 업데이트
    $.each($boxes, function (index, box) {
      $boxContainer.append(box);
    });
  }

  // slider-wrap이 존재할 때만 랜덤 배치
  if ($(".slider-wrap").length) {
    randomizeBoxes();
    updateSlides(); // 랜덤배치 후 초기 슬라이드 상태 업데이트
  }
}

  // 악기 마우스 오버
  var audioPlayed = {}; // 오디오 재생 기록을 저장할 객체
  var currentAudio = null; // 현재 재생 중인 오디오를 추적할 변수

  $(".draggable").on("mouseover", function () {
    var audioName = $(this).data("name");
    var audioSrc = "sound/effect/" + audioName + ".mp3";

    // 새로운 오디오 객체 생성
    var newAudio = new Audio(audioSrc);

    if (currentAudio) {
      currentAudio.pause(); // 오디오를 일시 정지
      currentAudio.currentTime = 0; // 현재 재생 위치를 0으로 설정 (필요 시)
    }

    // 오디오가 이미 재생된 적이 있는지 확인
    if (!audioPlayed[audioName]) {
      newAudio.play(); // 새로운 오디오 재생

      // // 악기 이름 한번씩만 재생
      // newAudio.onended = function () {
      //   audioPlayed[audioName] = true; // 재생 완료 기록
      // };
    }

    // 현재 재생 중인 오디오를 새 오디오로 업데이트
    currentAudio = newAudio;
  });

  // 드래그
  $(".draggable").draggable({
    helper: "clone",
    start: function (event, ui) {
      ui.helper.css({
        "z-index": "7",
      });
    },
    drag: function (event, ui) {
      ui.position.left = ui.position.left;
      ui.position.top = ui.position.top;
    },
    revert: function(droppableObj) {
      // answer 속성이 "true"가 아닌 경우에만 원래 위치로 돌아가게 설정
      if (!droppableObj || droppableObj.attr("answer") !== "true") {
        return true; // 원래 위치로 돌아감
      }
      return false; // 드롭된 위치에 남음
    }
  });
  var drop = 0; //정답 수
  var faliEffect = new Audio("./sound/effect/fali_effect.mp3");
  var successEffect = new Audio("./sound/effect/success_effect.mp3");
  $(".dropzon").droppable({
    accept: ".draggable",
    revert: "invalid",
    
    drop: function (event, ui) {
      var answer = ui.helper.attr("answer");
      var name = ui.helper.data("name");
      var originalElement = ui.draggable;
      
      // 나레이션 재생
      
      var faliAudio = new Audio("./sound/narration/fali.mp3");
      
      if (answer === "true") {
        var scucessAudio = new Audio("./sound/narration/" + name + ".mp3");
        var musicalAudio = new Audio("./sound/contents_01/musical_" + name + ".mp3"); //악기소리
        
        originalElement.parent().addClass("disabled");
        $(this).addClass(name);
        $(this).addClass("active");
        $(this).find("success").addClass("acive");
        $(this).droppable("disable");
        //악기 소리후 나레이션
        musicalAudio.addEventListener("ended", function () {
          scucessAudio.play();
        });
        successEffect.play();
        musicalAudio.play(); //악기소리
        ui.helper.remove();
        drop++
      } else {
        faliEffect.addEventListener("ended", function () {
          faliAudio.play();
        });
        faliEffect.play();
      }
      // 끝
      if (drop >= 6) {
        setTimeout(activeFinish01, 3000);
      }
      console.log(drop)
    },
  });

  var congratsAudio = new Audio("./sound/effect/congrats.mp3"); // 축하 오디오
  var commonFinishAudio = new Audio("./sound/bgm/common_finish.mp3"); // 활동종료 공통(대취타 연주)
  
  
  //활동1 미션 성공
  var finishAudio = new Audio("./sound/narration/finish.mp3"); // 미션 완료 오디오
  function activeFinish01() {
    congratsAudio.addEventListener("ended", function () {
      finishAudio.play();
    });

    finishAudio.addEventListener("ended", function () {
      commonFinishAudio.play();
    });

    congratsAudio.play();

    $(".finish").fadeIn();
  }

  function finishpause(){
    finishAudio.pause()
    commonFinishAudio.pause()
  }

  $(".dialog-close").click(function () {
    $(".dialog").fadeOut();
  });

  var infoEffectAudio = new Audio("./sound/effect/info.mp3");
  $(".btn-more").click(function () {
    var infoNarrationAudio = new Audio("./sound/narration/info_01.mp3");
    infoEffectAudio.addEventListener("ended", function () {
      infoNarrationAudio.play();
    });
    infoEffectAudio.play();
    $(".dialog").fadeIn();
    finishpause(); //활동종료 오디오 중지
  });

  var missionItems = [
    "jeonlib",
    "hwang",
    "jeondae",
    "mituli",
    "gugunbog",
    "deungchae",
    "heughye",
  ]; // 미션 항목 배열
  var currentIndex = 0; // 현재 미션 항목 인덱스
  var faliAudio2 = new Audio("sound/narration/fali_02.mp3"); // 실패 시 재생할 오디오 파일
  var bgm02 = document.getElementById("bgm02"); // 배경 음악 요소
  var missionAudio = new Audio(); // 미션 오디오 객체
  var boyCompleteAudio = new Audio("sound/narration/boy_complete.mp3"); // boy 드래그 완료 시 재생할 오디오
  var girlCompleteAudio = new Audio("sound/narration/girl_complete.mp3"); // girl 드래그 완료 시 재생할 오디오
  var boyCompletedCount = 0; // boy 드롭존에서 완료된 항목 수
  var girlCompletedCount = 0; // girl 드롭존에서 완료된 항목 수
  var isMissionAudioPlaying = false; // 미션 오디오가 현재 재생 중인지 여부

// 초기 미션 항목 이미지 표시
if ($(".select-02").length > 0) {
    updateMissionImage();
}

// 드래그 가능한 박스 설정
$(".cl_draggable").draggable({
    helper: "clone",
    start: function (event, ui) {
        $(ui.helper).addClass("ui-draggable-dragging");
    },
    stop: function (event, ui) {
        $(ui.helper).removeClass("ui-draggable-dragging");
    },
});

// 드롭 가능한 구역 설정
$(".clothes-drop").droppable({
    accept: ".cl_draggable",
    drop: function (event, ui) {
        var dropZone = $(this); // 드롭존
        var draggable = $(ui.helper); // 드래그된 요소
        var name = draggable.data("name"); // 드래그된 요소의 이름
        var isAccepted = dropZone.data("target") === draggable.data("target"); // 타겟 비교
        var originalElement = ui.draggable;
        // 올바른 미션 항목이 드롭된 경우
        if (isAccepted && name === missionItems[currentIndex]) {
            $(this).addClass(name);
            originalElement.parent().addClass("disabled");
            successEffect.play();
            // 현재 미션 항목 업데이트
            currentIndex++;
            if (currentIndex < missionItems.length) {
                updateMissionImage();
            } else {
                $(".select-02").addClass("complete");
                $(".cl_effect").removeClass("cl-active"); // 반짝이 제거
                setTimeout(activeFinish02, 2000);
            }
            
            // 드롭존이 'boy'일 경우
            if (dropZone.hasClass("boy")) {
                boyCompletedCount++;
                if (boyCompletedCount <= 4) { // 최대 4개까지 boyCompleteAudio 재생
                    playCompleteAudio(boyCompleteAudio);
                }

                if (boyCompletedCount === 4) {
                    boyCompletedCount = 0; // 완료된 항목 수 초기화
                }
            }

            // 드롭존이 'girl'일 경우
            if (dropZone.hasClass("girl")) {
                girlCompletedCount++;
                if (girlCompletedCount <= 3) { // 최대 3개까지 girlCompleteAudio 재생
                    playCompleteAudio(girlCompleteAudio);
                }

                if (girlCompletedCount === 3) {
                    girlCompletedCount = 0; // 완료된 항목 수 초기화
                }
            }
        } else {
            // 타겟이 일치하지 않거나 미션 항목이 일치하지 않는 경우 오디오 재생
            faliEffect.play();
            faliAudio2.play();
        }
    },
});

function finishpause2(){
  finishAudio2.pause()
  commonFinishAudio.pause()
}

// 완료
var finishAudio2 = new Audio("./sound/narration/finish02.mp3");
function activeFinish02() {
  congratsAudio.addEventListener("ended", function () {
    finishAudio2.play();
  });

  finishAudio2.addEventListener("ended", function () {
    commonFinishAudio.play();
  });
  congratsAudio.play();
  $(".finish").fadeIn();
}


// 완료 오디오를 재생한 후 미션 오디오 재생
function playCompleteAudio(completeAudio) {
    if (isMissionAudioPlaying) {
        missionAudio.pause();
    }

    completeAudio.play();

    completeAudio.onended = function () {
        if (currentIndex < missionItems.length) {
            missionAudio.src = "sound/narration/" + missionItems[currentIndex] + ".mp3";
            missionAudio.play();
            isMissionAudioPlaying = true;
        }
    };
}

  // 팝업 슬라이드
let currentImg = 0;
const images = $(".dialog .sd > div");
const totalImages = images.length;

const moreAudio1 = new Audio("./sound/contents_02/more_01.mp3"); // 1번 오디오
const moreAudio2 = new Audio("./sound/contents_02/more_02.mp3"); // 2번 오디오

// 현재 재생 중인 오디오를 추적하는 변수
let currentMoreAudio = null;

function showImage(index, playAudio = true) {
  images.removeClass("active").eq(index).addClass("active");
  currentImg = index; // 현재 이미지를 업데이트

  // 현재 재생 중인 오디오가 있으면 중지
  if (currentMoreAudio) {
    currentMoreAudio.pause();
    currentMoreAudio.currentTime = 0; // 오디오를 처음으로 되감기
  }

  // 해당 인덱스에 맞는 오디오 설정
  if (index === 0) {
    currentMoreAudio = moreAudio1;
  } else if (index === 1) {
    currentMoreAudio = moreAudio2;
  } else {
    currentMoreAudio = null; // 해당하는 오디오가 없을 경우 null로 설정
  }

  // playAudio가 true이고 currentMoreAudio가 존재하면 오디오 재생
  if (playAudio && currentMoreAudio) {
    currentMoreAudio.play();
  }

  // 첫 번째 페이지에서 prev 버튼 숨기기
  if (index === 0) {
    $(".dialog .prev").hide();
  } else {
    $(".dialog .prev").show();
  }

  // 마지막 페이지에서 next 버튼 숨기기
  if (index === totalImages - 1) {
    $(".dialog .next").hide();
  } else {
    $(".dialog .next").show();
  }
}

// '더 알아보기' 버튼 클릭 시 첫 번째 이미지와 1번 오디오 재생
$(".btn-more2").click(function () {
  $(".dialog").show(); // 다이얼로그를 표시
  
  infoEffectAudio.play();
  showImage(0, true); // 첫 번째 이미지 표시 및 오디오 재생
  finishpause2();
});

// 다음 버튼 클릭 이벤트
$(".dialog .next").click(function () {
  if (currentImg < totalImages - 1) {
    showImage(currentImg + 1, true);
  }
});

// 이전 버튼 클릭 이벤트
$(".dialog .prev").click(function () {
  if (currentImg > 0) {
    showImage(currentImg - 1, true);
  }
});

// 초기 상태에서 첫 번째 이미지를 표시하지만 오디오 재생하지 않음
showImage(currentImg, false);

// 다이얼로그 초기 숨김 처리
$(".dialog").hide();

  // 이미지 및 오디오 업데이트 함수
  function updateMissionImage() {
    var missionItem = missionItems[currentIndex];
    var imageUrl = "img/content_02/lg_txt_" + missionItem + ".png"; // 이미지 파일 경로
    var audioUrl = "sound/narration/" + missionItem + ".mp3"; // 미션 오디오 파일 경로
    
    $(".cl_effect").each(function () {
      var name = $(this).data("name");
      if (missionItem == name) {
        $(this).addClass("cl-active");
      } else {
        $(this).removeClass("cl-active");
      }
    });

    // 배경 음악을 재생하고, 끝난 후 미션 오디오를 재생합니다.
    if (!bgm02.hasPlayed) {
      bgm02.volume = 1; // 배경 음악의 음량을 원래대로 복구
      bgm02.play();

      // 배경 음악이 끝난 후 미션 오디오 재생
      bgm02.onended = function () {
        missionAudio.src = audioUrl; // 미션 오디오의 소스 설정
        missionAudio.play(); // 미션 오디오 재생
        isMissionAudioPlaying = true; // 미션 오디오가 재생 중임을 표시
        bgm02.hasPlayed = true; // 배경 음악이 재생되었음을 표시
      };
    } else {
      missionAudio.src = audioUrl; // 미션 오디오의 소스 설정
      missionAudio.play(); // 미션 오디오 재생
      isMissionAudioPlaying = true; // 미션 오디오가 재생 중임을 표시
    }

    // 이미지 업데이트
    $(".txt-box").html('<img src="' + imageUrl + '" alt="미션 이미지"/>');
  }
});
