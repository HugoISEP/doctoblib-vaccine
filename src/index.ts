import puppeteer, {ElementHandle, Page} from 'puppeteer';

const username = "hugo.chemillier@gmail.com"
const password = "password"
const URL_WITH_CATEGORY = "https://www.doctolib.fr/vaccination-covid-19/paris?availabilities=3&ref_visit_motive_ids%5B%5D=6970&ref_visit_motive_ids%5B%5D=7005";
const DAY_TO_VACCINE = "lundi";

const findAppointment = async (page: Page) => {
    const slotsAvailable: ElementHandle[] = [];
    while(slotsAvailable.length === 0){
        await page.goto(URL_WITH_CATEGORY, {waitUntil: "networkidle0"});

        //await page.waitForSelector(".availabilities-day");
        const availableDays =  await page.$$(".availabilities-day")
        for (const availableDay of availableDays){
            const dayString = await availableDay.$$eval(".availabilities-day-name", (nodes) => nodes.map((n) => (<HTMLElement>n).innerText)[0]);
            const slots = await availableDay.$$(".Tappable-inactive");
            if (dayString === DAY_TO_VACCINE && slots.length !== 0 ){
                slots.forEach(slot => slotsAvailable.push(slot));
            }
        }
    }
    const random = Math.floor(Math.random() * slotsAvailable.length);
    await slotsAvailable[random].click();
    await page.waitForNavigation();
};

const completeAppointment = async (page: Page) => {

    const selectBookingSpeciality = await page.evaluate(() => {
        return !!document.querySelector("#booking_motive_category")
    })
    if (selectBookingSpeciality){
        await page.select("select#booking_speciality", "5494");
    }

    const selectBookingMotiveCategory = await page.evaluate(() => {
        return !!document.querySelector("#booking_motive_category")
    })
    if (selectBookingMotiveCategory){
        console.log("selectBookingMotiveCategory selected")
        let text = await page.select("select#booking_motive_category", "patients-de-moins-50-ans-5494");
        if (text[0] === ""){
            text = await page.select("select#booking_motive_category", "de-18-a-54-ans-avec-comorbidite-5494");
        }
        console.log("selectBookingMotiveCategory", text)
    }

    await page.waitForSelector("#booking_motive", {timeout: 500});

    const selectBookingMotive = await page.evaluate(() => {
        return !!document.querySelector("#booking_motive")
    })

    if (selectBookingMotive){
        let isSelected = await page.select("select#booking_motive", "1re injection vaccin COVID-19 (Pfizer-BioNTech)-5494");
        if (isSelected[0] === ""){
            isSelected = await page.select("select#booking_motive", "1re injection vaccin COVID-19 (Moderna)-5494");
        }
        if (isSelected[0] === ""){
            isSelected = await page.select("select#booking_motive", "1re injection vaccin COVID-19 (Pfizer-BioNTech)-5494-tout-public-5494");
        }
        console.log("selectBookingMotive", isSelected)
    }

    await page.waitForSelector(".availabilities-slots .Tappable-inactive", {timeout: 3000})
        .then(() => console.log(".Tappable-inactive"))
        .catch(e => console.log("ERROR Tappable-inactive", e))

    const availableDays =  await page.$$(".availabilities-day")
    for (const availableDay of availableDays){
        const dayString = await availableDay.$$eval(".availabilities-day-name", (nodes) => nodes.map((n) => (<HTMLElement>n).innerText)[0]);
        if (dayString === DAY_TO_VACCINE.substr(0, 3) + "."){
            const slots = await availableDay.$$(".Tappable-inactive");
            if (slots.length !== 0 ){
                const content = await slots[0].getProperty("title");
                const text = await content?.jsonValue();
                await page.evaluate((selector) => {
                    document.querySelector(selector).click();
                }, `[title="${text}"]`);
                console.log("ENTER BAD ENTRY")
                return true;
            } else {
                throw "No slot find for first appointment"
            }
        }
    }
    throw "Error when completing apppointment";
};


const findSecondAppointment = async (page: Page) => {
    await page.waitForSelector(".availabilities-slots .Tappable-inactive", {timeout: 3000})
        .then(() => console.log(".Tappable-inactive"))
        .catch(e => console.log("ERROR Tappable-inactive", e))

    const slots = await page.$$(".availabilities-slots .Tappable-inactive");
    await page.waitForTimeout(2000);
    if (slots[0]){
        console.log("second Appointment first option");
        const content = await slots[0].getProperty("title");
        const text = await content?.jsonValue();
        await page.evaluate((selector) => {
            document.querySelector(selector).click();
        }, `[title="${text}"]`);
        return true;
    } else {
        console.log("second Appointment second option");
        const button = await page.waitForSelector(".availabilities-next-slot", {timeout: 1000});
        await button?.click();
        await page.waitForSelector(".availabilities-slots .Tappable-inactive", {timeout: 3000})
            .then(() => console.log(".Tappable-inactive"))
            .catch(e => console.log("ERROR Tappable-inactive", e))
        const slots = await page.$$(".availabilities-slots .Tappable-inactive");
        const content = await slots[0].getProperty("title");
        const text = await content?.jsonValue();
        await page.evaluate((selector) => {
            document.querySelector(selector).click();
        }, `[title="${text}"]`);
        return true;
    }
};

const connexion = async (page: Page) => {
    let connexionButton: ElementHandle;
    await page.waitForSelector(".dl-button-DEPRECATED_yellow", {timeout: 1500})
        .then(res => res?.click())
        .catch((e) => console.log("pas grave"));
    //await connexionButton?.click();
    await page.waitForTimeout(1000);
    await page.type('#password', password);
    await page.keyboard.press('Enter');
    return true;
}

const acceptRules = async (page: Page) => {
    await page.waitForTimeout(1000);
    while (await page.evaluate(() => {
        return !!document.querySelector("button.dl-button-check-inner:not([disabled])")
    })) {
        const button = await page.waitForSelector("button.dl-button-check-inner:not([disabled])", {timeout: 1500});
        await button?.click();
        await page.waitForTimeout(1000);
    }

    const finalButton = await page.waitForSelector(".booking-motive-rule-button", {timeout: 1000});
    finalButton?.click();
    return true;
};

(async () => {

    let complete = false;
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage()

    while (!complete){
        try{
            await findAppointment(page);
            console.log("END findAppointment");
            complete = await completeAppointment(page);
            console.log("END completeAppointment");
            complete = await findSecondAppointment(page);
            console.log("END findSecondAppointment");
            //complete = await connexion(page);
        } catch (e) {
            complete = false;
        }
    }
    try{
        complete = await acceptRules(page);
        console.log("END acceptRules");
        await connexion(page);
        console.log("FINISH");
    } catch (e){

    }


})();

