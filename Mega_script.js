let categories = {
    writers: [
        "Пушкин Александр Сергеевич",
        "Лермонтов Михаил Юрьевич",
        "Гоголь Николай Васильевич",
        "Достоевский Фёдор Михайлович",
        "Чехов Антон Павлович",
        "Толстой Лев Николаевич"
    ],

    scientists: [
        "Менделеев Дмитрий Иванович",
        "Циолковский Константин Эдуардович",
        "Эйнштейн Альберт",
        "Фарадей Майкл",
        "Тесла Никола"
    ],

    rulers: [
        "Наполеон Бонапарт",
        "Юлий Цезарь",
        "Пётр I",
        "Екатерина II",
        "Сталин Иосиф Виссарионович",
        "Ленин Владимир Ильич",
        "Клеопатра"
    ],

    artists: [
        "Леонардо да Винчи",
        "Моцарт Вольфганг Амадей",
        "Бах Иоганн Себастьян",
        "Ван Гог Винсент",
        "Пикассо Пабло",
        "Бетховен Людвиг ван"
    ],

    other: [
        "Склодовская-Кюри Мария",
        "Жанна д'Арк",
        "Джобс Стив",
        "Кинг Мартин Лютер",
        "Ганди Махатма"
    ]
};

let people = {};

function getPhoto(name) {
    let title = encodeURIComponent(name.replace(" ", "_"));

    return fetch(
        "https://ru.wikipedia.org/api/rest_v1/page/summary/" + title
    )
    .then(response => response.json())
    .then(data => {
        if (data.thumbnail) {
            return data.thumbnail.source;
        }

        return null;
    })
    .catch(() => null);
}

function createPopup(name, type, description, photo) {

    let place = description;

    if (type === "birth") {
        place = place.replace(name + " - рождение: ", "");
    }

    if (type === "death") {
        place = place.replace(name + " - смерть: ", "");
    }

    let title = type === "birth" ? "Рождение" : "Смерть";

    let photoHTML = "";

    if (photo) {
        photoHTML = `
            <img
                src="${photo}"
                style="
                    width:100%;
                    max-height:180px;
                    object-fit:cover;
                    border-radius:12px;
                    margin-bottom:12px;
                "
            >
        `;
    }

    return `
        <div style="min-width:220px; max-width:280px;">
            ${photoHTML}

            <div style="
                font-weight:700;
                font-size:17px;
                margin-bottom:8px;
            ">
                ${name}
            </div>

            <div style="font-size:14px;">
                <strong>${title}:</strong> ${place}
            </div>
        </div>
    `;
}

fetch("baze-data.csv")
    .then(response => response.text())
    .then(data => {

        let rows = data.trim().split("\n");

        for (let i = 1; i < rows.length; i++) {

            let parts = rows[i].split(";");

            let latitude = parseFloat(parts[0].replace(",", "."));
            let longitude = parseFloat(parts[1].replace(",", "."));
            let description = parts[2];
            let label = parts[3];

            let name = label
                .replace(" - рождение", "")
                .replace(" - смерть", "");

            if (!people[name]) {
                people[name] = {};
            }

            if (label.includes("рождение")) {
                people[name].birth = [longitude, latitude];
                people[name].birthDescription = description;
            }

            if (label.includes("смерть")) {
                people[name].death = [longitude, latitude];
                people[name].deathDescription = description;
            }
        }

        for (let name in people) {

            let person = people[name];

            let category = "other";

            for (let categoryName in categories) {
                if (categories[categoryName].includes(name)) {
                    category = categoryName;
                }
            }

            person.category = category;

            getPhoto(name).then(photo => {

                let birthPosition = person.birth;
                let deathPosition = person.death;

                if (
                    person.birth &&
                    person.death &&
                    person.birth[0] === person.death[0] &&
                    person.birth[1] === person.death[1]
                ) {

                    birthPosition = [
                        person.birth[0] - 0.02,
                        person.birth[1]
                    ];

                    deathPosition = [
                        person.death[0] + 0.02,
                        person.death[1]
                    ];
                }

                if (person.birth) {

                    person.birthMarker = new maplibregl.Marker({
                        color: "#378ADD"
                    })
                    .setLngLat(birthPosition)
                    .setPopup(
                        new maplibregl.Popup()
                            .setHTML(
                                createPopup(
                                    name,
                                    "birth",
                                    person.birthDescription,
                                    photo
                                )
                            )
                    )
                    .addTo(map);
                }

                if (person.death) {

                    person.deathMarker = new maplibregl.Marker({
                        color: "#D64545"
                    })
                    .setLngLat(deathPosition)
                    .setPopup(
                        new maplibregl.Popup()
                            .setHTML(
                                createPopup(
                                    name,
                                    "death",
                                    person.deathDescription,
                                    photo
                                )
                            )
                    )
                    .addTo(map);
                }

            });
        }

        let lines = [];

        for (let name in people) {

            let person = people[name];

            if (person.birth && person.death) {

                let start = person.birth;
                let end = person.death;

                if (
                    person.birth[0] === person.death[0] &&
                    person.birth[1] === person.death[1]
                ) {

                    start = [
                        person.birth[0] - 0.02,
                        person.birth[1]
                    ];

                    end = [
                        person.death[0] + 0.02,
                        person.death[1]
                    ];
                }

                lines.push({
                    name: name,
                    category: person.category,
                    coordinates: [
                        start,
                        end
                    ]
                });
            }
        }

        function addLines() {

            if (map.getSource("life-lines")) {
                return;
            }

            map.addSource("life-lines", {
                type: "geojson",

                data: {
                    type: "FeatureCollection",

                    features: lines.map(line => ({
                        type: "Feature",

                        properties: {
                            name: line.name,
                            category: line.category
                        },

                        geometry: {
                            type: "LineString",
                            coordinates: line.coordinates
                        }
                    }))
                }
            });

            map.addLayer({
                id: "life-lines",
                type: "line",
                source: "life-lines",

                paint: {
                    "line-color": "#378ADD",
                    "line-width": 2
                }
            });
        }

        if (map.isStyleLoaded()) {
            addLines();
        } else {
            map.once("load", addLines);
        }

        document
            .querySelectorAll(".categories li")
            .forEach(button => {

                button.addEventListener("click", () => {

                    document
                        .querySelectorAll(".categories li")
                        .forEach(item => {
                            item.classList.remove("active");
                        });

                    button.classList.add("active");

                    let selectedCategory =
                        button.dataset.category;

                    for (let name in people) {

                        let person = people[name];

                        let show =
                            person.category === selectedCategory;

                        if (person.birthMarker) {
                            person.birthMarker
                                .getElement()
                                .style.display =
                                show ? "block" : "none";
                        }

                        if (person.deathMarker) {
                            person.deathMarker
                                .getElement()
                                .style.display =
                                show ? "block" : "none";
                        }
                    }

                    let source =
                        map.getSource("life-lines");

                    if (source) {

                        let filteredLines =
                            lines
                                .filter(line =>
                                    line.category === selectedCategory
                                )
                                .map(line => ({
                                    type: "Feature",

                                    properties: {
                                        name: line.name,
                                        category: line.category
                                    },

                                    geometry: {
                                        type: "LineString",
                                        coordinates: line.coordinates
                                    }
                                }));

                        source.setData({
                            type: "FeatureCollection",
                            features: filteredLines
                        });
                    }

                });

            });

    });