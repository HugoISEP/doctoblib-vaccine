import puppeteer, {ElementHandle, Page} from 'puppeteer';

const username = "hugo.chemillier@gmail.com"
const password = "password"
const URL_WITH_CATEGORY = "https://www.doctolib.fr/vaccination-covid-19/paris?availabilities=3&ref_visit_motive_ids%5B%5D=6970&ref_visit_motive_ids%5B%5D=7005";
const DAY_TO_VACCINE = "lundi";
const URL_LOGIN = "https://www.doctolib.fr/sessions/new"

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
        return !!document.querySelector("#booking_speciality")
    });
    if (selectBookingSpeciality){
        await page.select("select#booking_speciality", "5494");
    }

    const visitMotiveButton = await page.evaluate(() => {
        return !!document.querySelector("[for=\"all_visit_motives-1\"]")
    });
    if (visitMotiveButton){
        await page.click("[for=\"all_visit_motives-1\"]");
    }

    const selectBookingMotiveCategory = await page.evaluate(() => {
        return !!document.querySelector("#booking_motive_category")
    })
    if (selectBookingMotiveCategory){
        let optionSelected = await page.select("select#booking_motive_category", "patients-de-moins-50-ans-5494");
        if (optionSelected[0] === ""){
            optionSelected = await page.select("select#booking_motive_category", "de-18-a-54-ans-avec-comorbidite-5494");
        }
        if (optionSelected[0] === ""){
            optionSelected = await page.select("select#booking_motive_category", "vaccination-pfizer-5494");
        }
        console.log("selectBookingMotiveCategory: " + optionSelected[0])
    }

    await page.waitForSelector("#booking_motive", {timeout: 500});

    const selectBookingMotive = await page.evaluate(() => {
        return !!document.querySelector("#booking_motive")
    })

    if (selectBookingMotive){
        let optionSelected = await page.select("select#booking_motive", "1re injection vaccin COVID-19 (Pfizer-BioNTech)-5494");
        if (optionSelected[0] === ""){
            optionSelected = await page.select("select#booking_motive", "1re injection vaccin COVID-19 (Moderna)-5494");
        }
        if (optionSelected[0] === ""){
            optionSelected = await page.select("select#booking_motive", "1re injection vaccin COVID-19 (Pfizer-BioNTech)-5494-tout-public-5494");
        }
        if (optionSelected[0] === ""){
            optionSelected = await page.select("select#booking_motive", "1re injection vaccin COVID-19 (Pfizer-BioNTech)-5494-grand-public-5494");
        }
        console.log("selectBookingMotive: " + optionSelected)
    }

    await page.waitForSelector(".availabilities-slots .Tappable-inactive", {timeout: 3000})
        .catch(() => {throw "No slot found"})

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

const checkCanContinue = async (page: Page) => {
    await page.waitForSelector(".availabilities-slots .Tappable-inactive", {timeout: 1500})
        .catch(e => {
            throw "Modal accepting rules is not open";
        });
}

const connexion = async (page: Page) => {
    let connexionButton: ElementHandle;
    await page.waitForSelector(".dl-button-DEPRECATED_yellow", {timeout: 1500})
        .then(res => res?.click())
        .catch((e) => console.log("pas grave"));
    await page.waitForTimeout(1000);
    await page.type('#username', username);
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


const logUser = async (page: Page) => {
    await page.goto(URL_LOGIN, {waitUntil: "networkidle0"});
    await page.waitForTimeout(1000);

    await page.type("#username", username);
    
    /*
        On this page there are 2 input password, however only the first one is the correct one,
        but we can only use it if we get both input and then select the correct one (which is in the second place in array weirdly)
    */
    const input_password = await page.$$("#password");
    await input_password[1]?.type(password)

    await page.click(".dl-button-DEPRECATED_yellow")
    return page.url() === "https://www.doctolib.fr/account/appointments";
}


// Starting point
(async () => {
    let complete = false;

    /* Launch Puppeteer */
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage()

    /* First connect to Doctolib via user account */
    if(await logUser(page))
        console.log("Login successful");

    /* Keep searching an available appointment while none as been found */
    while (!complete){
        try{
            await findAppointment(page);
            console.log("END findAppointment");
            complete = await completeAppointment(page);
            console.log("END completeAppointment");
            complete = await findSecondAppointment(page);
            console.log("END findSecondAppointment");
            await checkCanContinue(page);
        } catch (e) {
            console.log("ERROR: " + e);
            complete = false;
        }
    }

    /* Accept all rules asked by organisation */
    try{
        await acceptRules(page);
        console.log("END acceptRules");
        console.log("FINISH");
    } catch (e){
    }
})();

