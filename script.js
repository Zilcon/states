// ===== グローバル変数 =====
let pagename = [];
let maprows = [];
let countryall = [];
let selectedPage = null;
let panZoomInstance = null;

// 手動ドラッグ判定用の変数
let isDragging = false;

// 建国機能用の変数
let isCreatingCountry = false;
let newCountryInfo = { name: '', color: '' };
let selectedPathsForNewCountry = [];

// ===== データ取得と初期設定 =====
fetch("https://wild-pond-809d.zilcon211006.workers.dev/") // ※ご自身のGASのURLに書き換えてください
  .then(res => res.ok ? res.json() : Promise.reject(new Error('Network response was not ok.')))
  .then(data => {
    const mapContainer = document.getElementById('map-container');
    const innerSvg = document.getElementById('map');
    const wrapperSvg = document.getElementById('wrapper');
    if (mapContainer && innerSvg && wrapperSvg) {
        mapContainer.removeChild(wrapperSvg);
        mapContainer.appendChild(innerSvg);
    } else {
        alert("マップの読み込みに失敗しました。");
        return;
    }

    const map = data["MapData"];
    const country = data["CountryData"];
    pagename = map[0];
    maprows = map.slice(1);
    countryall = country;

    setupUI();
    
    if (pagename.length > 1) {
        selectedPage = pagename[1];
        const firstButton = document.querySelector('#button-container button');
        if(firstButton) firstButton.classList.add('active');
        renderMapForTab(selectedPage);
    }

    // ★★★ pan/zoomのオプションを修正 ★★★
    panZoomInstance = svgPanZoom('#map', {
      zoomEnabled: true,
      panEnabled: true,
      controlIconsEnabled: false, // UI（+/-ボタン）を非表示にする
      dblClickZoomEnabled: false, // ダブルクリックによるズームを無効にする
      fit: true,
      center: true,
      minZoom: 0.5,
      maxZoom: 10,
      onPan: () => { isDragging = true; },
      onZoom: () => { isDragging = true; }
    });
    
    window.addEventListener('resize', () => {
        panZoomInstance.resize();
        panZoomInstance.fit();
        panZoomInstance.center();
    });
  })
  .catch(error => {
    console.error('データの取得に失敗しました:', error);
    alert('データの取得に失敗しました。ページを再読み込みしてください。');
  });

function setupUI() {
    pagename.forEach(name => createPageButton(name));
    
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.addEventListener('mousedown', () => {
            isDragging = false;
        });
        mapElement.addEventListener('click', (e) => {
            if (isDragging) {
                return;
            }
            const path = e.target.closest('path');
            if (path) {
                handleMapClick(path);
            }
        });
    }

    const createCountryBtn = document.getElementById('create-country-btn');
    if (createCountryBtn) createCountryBtn.addEventListener('click', handleCreateCountryBtnClick);
    const saveDataBtn = document.getElementById('save-data-btn');
    if (saveDataBtn) saveDataBtn.addEventListener('click', saveData);
}

function handleMapClick(path) {
    console.log("クリックされたPathの情報:", path);
    const datapath = path.id;
    const rowIndex = maprows.findIndex(row => String(row[0]).trim() === datapath.trim());
    if (rowIndex === -1) {
        console.error(`ID「${datapath}」に一致するデータがスプレッドシートに見つかりませんでした。`);
        document.getElementById("infoBox").innerHTML = `<p>ID「${datapath}」のデータは見つかりませんでした。</p><p>スプレッドシートのIDと一致しているか確認してください。</p>`;
        return;
    }
    displayPathInfo(maprows[rowIndex]);
    if (isCreatingCountry) {
        const countryColIndex = pagename.indexOf("国");
        if (countryColIndex !== -1 && maprows[rowIndex][countryColIndex]) {
            alert("このマスは既に「" + maprows[rowIndex][countryColIndex] + "」の領土です。");
            return;
        }
        if (selectedPathsForNewCountry.includes(datapath)) {
            selectedPathsForNewCountry = selectedPathsForNewCountry.filter(id => id !== datapath);
            path.style.stroke = '';
            path.style.strokeWidth = '';
        } else {
            selectedPathsForNewCountry.push(datapath);
            path.style.stroke = 'yellow';
            path.style.strokeWidth = '3px';
        }
        return;
    }
    if (!selectedPage) {
        alert("更新したい項目（タブ）をクリックして選択してください。");
        return;
    }
    const colIndex = pagename.indexOf(selectedPage);
    if (colIndex === -1) return;
    if (selectedPage === "国") {
        const inputCountryName = prompt("このマスに設定する国名を入力してください。");
        if (!inputCountryName) return;
        const countryInfo = countryall.find(c => c[0] === inputCountryName);
        if (countryInfo) {
            path.style.fill = countryInfo[1];
            maprows[rowIndex][colIndex] = inputCountryName;
        } else {
            alert(`国「${inputCountryName}」は存在しません。`);
            return;
        }
    } else {
        const inputValue = prompt("1から100までの数値を入力してください。", "50");
        if (inputValue === null || inputValue === "") return;
        const numValue = parseInt(inputValue, 10);
        if (isNaN(numValue) || numValue < 1 || numValue > 100) {
            alert("1から100の範囲で数値を入力してください。");
            return;
        }
        path.style.fill = getGradientColor(numValue);
        maprows[rowIndex][colIndex] = numValue;
    }
    displayPathInfo(maprows[rowIndex]);
}

function createPageButton(buttonName) {
  const btn = document.createElement("button");
  btn.innerText = buttonName;
  btn.onclick = function() {
    selectedPage = buttonName;
    document.querySelectorAll('#button-container button').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    renderMapForTab(selectedPage);
  };
  const container = document.getElementById("button-container");
  if (container && pagename.indexOf(buttonName) > 0) {
      container.appendChild(btn);
  }
}
function renderMapForTab(tabName) {
    const colIndex = pagename.indexOf(tabName);
    if (colIndex === -1) return;
    maprows.forEach(row => {
        const pathId = row[0];
        const path = document.getElementById(pathId);
        if (!path) return;
        const cellValue = row[colIndex];
        if (!cellValue) {
            path.style.fill = '#eee';
            return;
        }
        if (tabName === "国") {
            const countryInfo = countryall.find(c => c[0] === cellValue);
            path.style.fill = countryInfo ? countryInfo[1] : '#eee';
        } else {
            const numValue = parseInt(cellValue, 10);
            path.style.fill = !isNaN(numValue) ? getGradientColor(numValue) : '#eee';
        }
    });
}
function handleCreateCountryBtnClick() {
    const btn = document.getElementById('create-country-btn');
    isCreatingCountry = !isCreatingCountry;
    if (isCreatingCountry) {
        const countryName = prompt("建国する国の名前を入力してください:");
        if (!countryName) { isCreatingCountry = false; return; }
        if (countryall.some(row => row[0] === countryName)) {
            alert("その国名は既に使用されています。");
            isCreatingCountry = false;
            return;
        }
        newCountryInfo.name = countryName;
        newCountryInfo.color = getRandomColor();
        selectedPathsForNewCountry = [];
        btn.innerText = '選択を完了して建国する';
        btn.style.backgroundColor = '#ffc107';
        alert(`「${countryName}」を建国します。マップ上の空きマスを選択してください。`);
    } else {
        if (selectedPathsForNewCountry.length > 0) {
            const countryColIndex = pagename.indexOf("国");
            if (countryColIndex === -1) {
                alert("エラー:「国」データ列が見つかりません。");
            } else {
                 selectedPathsForNewCountry.forEach(pathId => {
                    const rowIndex = maprows.findIndex(row => row[0] === pathId);
                    if (rowIndex !== -1) {
                        maprows[rowIndex][countryColIndex] = newCountryInfo.name;
                        const pathElement = document.getElementById(pathId);
                        if (pathElement) {
                            pathElement.style.fill = newCountryInfo.color;
                            pathElement.style.stroke = '';
                            pathElement.style.strokeWidth = '';
                        }
                    }
                });
                countryall.push([newCountryInfo.name, newCountryInfo.color]);
                alert(`「${newCountryInfo.name}」が建国されました！`);
            }
        }
        btn.innerText = '建国';
        btn.style.backgroundColor = '';
        selectedPathsForNewCountry = [];
    }
}
function displayPathInfo(pathData) {
    const infoBox = document.getElementById("infoBox");
    if (infoBox) {
        let listItems = pagename.map((header, index) => {
            const value = pathData[index] || '（データなし）';
            return `<li><strong>${header}:</strong> ${value}</li>`;
        }).join('');
        infoBox.innerHTML = `<h3>${pathData[0]}の情報</h3><ul>${listItems}</ul>`;
    }
}
function getGradientColor(value) {
    const hue = 120 - (value - 1) * (120 / 99);
    return `hsl(${hue}, 100%, 50%)`;
}
function getRandomColor() {
    return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
}
async function saveData() {
    if(!confirm("現在の変更をサーバーに保存しますか？")) return;
    const mapDataToSave = [pagename, ...maprows];
    const countryDataToSave = countryall;
    try {
        const response = await fetch("https://wild-pond-809d.zilcon211006.workers.dev/", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ MapData: mapDataToSave, CountryData: countryDataToSave }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`サーバーへの送信に失敗しました: ${response.status} ${errorText}`);
        }
        const result = await response.json();
        console.log("保存成功:", result);
        alert("データを保存しました。");
    } catch (error) {
        console.error('保存エラー:', error);
        alert('データの保存に失敗しました。\n' + error.message);
    }
}
