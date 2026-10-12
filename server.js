const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


/* ============================================================
   LUPA GPS
============================================================ */

const LUPA_BASE_URL = "http://www.lupagps.net";

const LUPA_USER = "Frigospeed_API";
const LUPA_PASSWORD = "gps2026";
const LUPA_GROUP_ID = "FrigospeedEurotop";

const LUPA_DEVICES_URL =
    `${LUPA_BASE_URL}/atlas/` +
    `${LUPA_GROUP_ID}/` +
    `${LUPA_USER}/devices` +
    `?password=${encodeURIComponent(LUPA_PASSWORD)}`;

const LUPA_POSITIONS_URL =
    `${LUPA_BASE_URL}/atlas/` +
    `${LUPA_GROUP_ID}/` +
    `${LUPA_USER}/positions` +
    `?password=${encodeURIComponent(LUPA_PASSWORD)}`;
/* ============================================================
   GEOCODARE DESTINAȚII
============================================================ */

async function getCoordinatesFromAddress(address) {

    const url =
        "https://nominatim.openstreetmap.org/search" +
        "?format=json" +
        "&limit=1" +
        "&q=" +
        encodeURIComponent(address);


    const response =
        await fetch(url, {
            headers: {
                "User-Agent":
                    "FrigoSpeed Fleet Management"
            }
        });


    if (!response.ok) {

        throw new Error(
            "Nu s-a putut căuta destinația."
        );

    }


    const data =
        await response.json();


    if (!data.length) {

        throw new Error(
            `Destinația "${address}" nu a fost găsită.`
        );

    }


    return {

        lat:
            Number(data[0].lat),

        lng:
            Number(data[0].lon)

    };

}
async function updateActiveTrips() {
    console.log(
    "NUMĂR CURSE ACTIVE:",
    curse.length
);
console.log(
    "CURSE SERVER:",
    JSON.stringify(curse)
);



    for (const cursa of curse) {

        // Dacă a ajuns deja la destinație,
        // nu mai calculăm kilometri.
        if (cursa.status === "Finalizata") {
            continue;
        }


        // Fără coordonate de destinație
        // nu putem verifica sosirea.
        if (
            !Number.isFinite(Number(cursa.destinatieLat)) ||
            !Number.isFinite(Number(cursa.destinatieLng))
        ) {
            continue;
        }


        try {

            /*
               Luăm pozițiile actuale din Lupa GPS.
            */
            const response =
                await fetch(LUPA_POSITIONS_URL);


            if (!response.ok) {
                continue;
            }


            const data =
                await response.json();


            const positions =
                data.positionList || [];


            /*
               Găsim camionul corespunzător cursei.
            */
            const truck =
                positions.find(
                    p =>
                        p.plateNumber === cursa.masina
                );
console.log(
    "CURSA:",
    cursa.masina,
    "CAMION GĂSIT:",
    !!truck
);


            if (!truck) {
                continue;
            }


            /*
               Coordonatele GPS actuale.
            */
            const truckLat =
                Number(
                    truck.coordinate?.latitude
                );

            const truckLng =
                Number(
                    truck.coordinate?.longitude
                );


            if (
                !Number.isFinite(truckLat) ||
                !Number.isFinite(truckLng)
            ) {
                continue;
            }


            /*
               Dacă avem o poziție GPS anterioară,
               calculăm distanța parcursă de la
               ultima poziție până la poziția actuală.
            */
            if (
                Number.isFinite(
                    Number(cursa.ultimaLatitudine)
                ) &&
                Number.isFinite(
                    Number(cursa.ultimaLongitudine)
                )
            ) {

                const distantaParcursa =
                    distanceKm(
                        Number(cursa.ultimaLatitudine),
                        Number(cursa.ultimaLongitudine),
                        truckLat,
                        truckLng
                    );


                /*
                   Adăugăm distanța la kilometrii
                   efectuați ai cursei.
                */
                if (
                    Number.isFinite(distantaParcursa) &&
                    distantaParcursa > 0 &&
                    distantaParcursa < 100
                ) {

                    cursa.kmEfectuati =
                        Number(
                            (
                                Number(cursa.kmEfectuati || 0) +
                                distantaParcursa
                            ).toFixed(2)
                        );

                }

            }


            /*
               Salvăm poziția actuală.
               La următoarea verificare aceasta
               va deveni poziția anterioară.
            */
            cursa.ultimaLatitudine =
                truckLat;

            cursa.ultimaLongitudine =
                truckLng;


            /*
               Verificăm dacă camionul a ajuns
               la destinație.
            */
            const aAjuns =
                isNearDestination(
                    truckLat,
                    truckLng,
                    Number(cursa.destinatieLat),
                    Number(cursa.destinatieLng)
                );


            if (aAjuns) {

                cursa.status =
                    "Finalizata";

                cursa.dataFinalizare =
                    new Date().toISOString();


                console.log(
                    `Cursa ${cursa.id} a ajuns la destinație.`
                );

                console.log(
                    `Kilometri efectuați: ${cursa.kmEfectuati} km`
                );

            }


        } catch (error) {

            console.error(
                "Eroare actualizare cursă:",
                error.message
            );

        }

    }

}
setInterval(() => {

    console.log(
        "TIMER CURSE GPS PORNIT:",
        new Date().toLocaleTimeString()
    );

    updateActiveTrips();

}, 30000);




/* ============================================================
   MEMORIE TEMPORARĂ PENTRU CURSE
============================================================ */

let curse = [];

let urmatorulIdCursa = 1;
/* ============================================================
   FUNCȚII GPS PENTRU CURSE
============================================================ */

/*
   Calculează distanța dintre două coordonate GPS
   folosind formula Haversine.

   Rezultatul este în kilometri.
*/
function distanceKm(lat1, lng1, lat2, lng2) {

    const R = 6371;

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLng =
        (lng2 - lng1) *
        Math.PI / 180;

    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *

        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}


/*
   Verifică dacă un camion a ajuns
   suficient de aproape de destinație.

   Momentan folosim o rază de 2 km.
*/
function isNearDestination(
    truckLat,
    truckLng,
    destinationLat,
    destinationLng
) {

    const distance =
        distanceKm(
            truckLat,
            truckLng,
            destinationLat,
            destinationLng
        );

    return distance <= 2;
}



/* ============================================================
   TEST SERVER
============================================================ */

app.get("/api/test", (req, res) => {

    res.json({
        ok: true,
        message: "Serverul FrigoSpeed funcționează."
    });

});


/* ============================================================
   LUPA - DISPOZITIVE
============================================================ */

app.get("/api/lupa/devices", async (req, res) => {

    try {

        console.log("Cerere dispozitive Lupa GPS...");

        const response = await fetch(LUPA_DEVICES_URL);

        const text = await response.text();

        if (!response.ok) {

            return res.status(response.status).json({
                ok: false,
                error: "Lupa GPS a returnat o eroare.",
                status: response.status,
                response: text
            });

        }

        let data;

        try {

            data = JSON.parse(text);

        } catch (e) {

            return res.json({
                ok: false,
                error: "Răspunsul Lupa GPS nu este JSON valid.",
                raw: text
            });

        }

        res.json({
            ok: true,
            data: data
        });

    } catch (error) {

        console.error("Eroare Lupa devices:", error);

        res.status(500).json({
            ok: false,
            error: error.message
        });

    }

});


/* ============================================================
   LUPA - POZIȚII
============================================================ */

app.get("/api/lupa/positions", async (req, res) => {

    try {

        console.log("Cerere poziții Lupa GPS...");

        const response = await fetch(LUPA_POSITIONS_URL);

        const text = await response.text();

        if (!response.ok) {

            return res.status(response.status).json({
                ok: false,
                error: "Lupa GPS a returnat o eroare.",
                status: response.status,
                response: text
            });

        }

        let data;

        try {

            data = JSON.parse(text);

        } catch (e) {

            return res.json({
                ok: false,
                error: "Răspunsul Lupa GPS nu este JSON valid.",
                raw: text
            });

        }

        res.json({
            ok: true,
            data: data
        });

    } catch (error) {

        console.error("Eroare Lupa positions:", error);

        res.status(500).json({
            ok: false,
            error: error.message
        });

    }

});


/* ============================================================
   CURSE - LISTARE
============================================================ */

app.get("/api/curse", (req, res) => {
console.log(
    "GET CURSE - SERVER:",
    curse.length
);

    res.json({
        ok: true,
        data: curse
    });

});


/* ============================================================
   CURSE - ADAUGARE
============================================================ */

/* ============================================================
   CURSE - ADAUGARE
============================================================ */

app.post("/api/curse", async (req, res) => {
    console.log(
    "CURSA PRIMITĂ DE SERVER:",
    req.body
);


    const {
        masina,
        sofer,
        plecare,
        destinatie,
        kmDeclarati,
        dataPlecare,
        dataIntoarcere,
        observatii
    } = req.body;


    if (!masina) {

        return res.status(400).json({
            ok: false,
            error: "Trebuie selectată mașina."
        });

    }
let destinatieLat = null;
let destinatieLng = null;

if (destinatie) {

    try {

        const coordonate =
            await getCoordinatesFromAddress(destinatie);

        destinatieLat =
            coordonate.lat;

        destinatieLng =
            coordonate.lng;

    } catch (error) {

        return res.status(400).json({
            ok: false,
            error:
                "Nu am putut găsi destinația: " +
                error.message
        });

    }

}


    if (!destinatie) {

        return res.status(400).json({
            ok: false,
            error: "Trebuie introdusă destinația."
        });

    }


    const cursaNoua = {

        id: urmatorulIdCursa++,

        masina:
            masina || "",

        sofer:
            sofer || "",

        plecare:
            plecare || "",

        destinatie:
            destinatie || "",

        kmDeclarati:
            Number(kmDeclarati) || 0,

        /*
           Kilometri efectuați de camion.
           Vor fi calculați din GPS.
        */
        kmEfectuati: 0,

        /*
           Păstrăm câmpul pentru compatibilitate.
        */
        kmGoogleMaps: 0,

        abatereKm: 0,

        procentAbatere: 0,

        /*
           Coordonatele destinației.
        */
      destinatieLat:
    destinatieLat,

destinatieLng:
    destinatieLng,


        /*
           Ultima poziție GPS.
        */
        ultimaLatitudine: null,

        ultimaLongitudine: null,

        /*
           Status cursă.
        */
        status: "IN_CURS",

        /*
           Se completează automat când ajunge.
        */
        dataSosire: null,

        dataPlecare:
            dataPlecare || "",

        dataIntoarcere:
            dataIntoarcere || "",

        observatii:
            observatii || "",

        createdAt:
            new Date().toISOString()

    };


    curse.push(cursaNoua);


    res.status(201).json({

        ok: true,

        message: "Cursa a fost adăugată.",

        data: cursaNoua

    });

});

/* ============================================================
   CURSE - ȘTERGERE
============================================================ */

app.delete("/api/curse/:id", (req, res) => {

    const id = Number(req.params.id);

    const index = curse.findIndex(
        cursa => cursa.id === id
    );


    if (index === -1) {

        return res.status(404).json({

            ok: false,

            error: "Cursa nu există."

        });

    }


    curse.splice(index, 1);


    res.json({

        ok: true,

        message: "Cursa a fost ștearsă."

    });

});


/* ============================================================
   CURSE - MODIFICARE
============================================================ */

app.put("/api/curse/:id", (req, res) => {

    const id = Number(req.params.id);

    const cursa = curse.find(
        c => c.id === id
    );


    if (!cursa) {

        return res.status(404).json({

            ok: false,

            error: "Cursa nu există."

        });

    }


    Object.assign(cursa, {

        masina:
            req.body.masina ?? cursa.masina,

        sofer:
            req.body.sofer ?? cursa.sofer,

        plecare:
            req.body.plecare ?? cursa.plecare,

        destinatie:
            req.body.destinatie ?? cursa.destinatie,

        kmDeclarati:
            Number(req.body.kmDeclarati ?? cursa.kmDeclarati),

        kmGoogleMaps:
            Number(req.body.kmGoogleMaps ?? cursa.kmGoogleMaps),

        dataPlecare:
            req.body.dataPlecare ?? cursa.dataPlecare,

        dataIntoarcere:
            req.body.dataIntoarcere ?? cursa.dataIntoarcere,

        observatii:
            req.body.observatii ?? cursa.observatii

    });


    /* Calculăm abaterea */

    cursa.abatereKm =
        cursa.kmDeclarati -
        cursa.kmGoogleMaps;


    if (cursa.kmGoogleMaps > 0) {

        cursa.procentAbatere =
            (
                Math.abs(cursa.abatereKm) /
                cursa.kmGoogleMaps
            ) * 100;

    } else {

        cursa.procentAbatere = 0;

    }


    res.json({

        ok: true,

        message: "Cursa a fost modificată.",

        data: cursa

    });

});


/* ============================================================
   DECONT - VERIFICARE KM
============================================================ */

app.get("/api/decont/:id", (req, res) => {

    const id = Number(req.params.id);

    const cursa = curse.find(
        c => c.id === id
    );


    if (!cursa) {

        return res.status(404).json({

            ok: false,

            error: "Cursa nu există."

        });

    }


    const kmDeclarati =
        Number(cursa.kmDeclarati) || 0;

    const kmGoogleMaps =
        Number(cursa.kmGoogleMaps) || 0;


    const abatereKm =
        kmDeclarati - kmGoogleMaps;


    let procentAbatere = 0;


    if (kmGoogleMaps > 0) {

        procentAbatere =
            (
                Math.abs(abatereKm) /
                kmGoogleMaps
            ) * 100;

    }


    let rezultat = "OK";


    if (kmGoogleMaps === 0) {

        rezultat = "NEVERIFICAT";

    } else if (Math.abs(abatereKm) > 10) {

        rezultat = "ABATERE";

    }


    res.json({

        ok: true,

        data: {

            cursaId: cursa.id,

            masina: cursa.masina,

            sofer: cursa.sofer,

            plecare: cursa.plecare,

            destinatie: cursa.destinatie,

            kmDeclarati: kmDeclarati,

            kmGoogleMaps: kmGoogleMaps,

            abatereKm: abatereKm,

            procentAbatere:
                Number(procentAbatere.toFixed(2)),

            rezultat: rezultat

        }

    });

});


/* ============================================================
   SERVER
============================================================ */

const PORT = 3000;

app.listen(PORT, () => {

    console.log("");

    console.log("==========================================");

    console.log(" FRIGOSPEED FLEET SERVER");

    console.log("==========================================");

    console.log(
        `Server pornit pe http://localhost:${PORT}`
    );

    console.log("");

    console.log(
        "Lupa devices:"
    );

    console.log(
        `http://localhost:${PORT}/api/lupa/devices`
    );

    console.log("");

    console.log(
        "Lupa positions:"
    );

    console.log(
        `http://localhost:${PORT}/api/lupa/positions`
    );

    console.log("");

    console.log(
        "Curse:"
    );

    console.log(
        `http://localhost:${PORT}/api/curse`
    );

    console.log("");

    console.log("==========================================");

    console.log("");

});
