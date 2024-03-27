// ==UserScript==
// @name         WK Flagger
// @namespace    http://tampermonkey.net/
// @version      2024-03-26
// @description  Add coloured flags to reviews as a memorization aid
// @author       Gorbit99 (original author), heavily customized by LupoMikti
// @match        https://www.wanikani.com/*
// @match        https://preview.wanikani.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wanikani.com
// @resource     flagger-style  https://raw.githubusercontent.com/lupomikti/wk-flagger/9c48411810c4334ef83b677e566ba94de62164b8/flagger.css
// @grant        GM_getResourceText
// @grant        unsafeWindow
// @license      MIT
// ==/UserScript==

import { WKOF, Menu } from './wkof'

declare global {
    interface Window {
        wkof: WKOF & Menu,
        Icons2: {
            readonly version: number,
            addCustomIcons: (icons: (string | number[])[][]) => void
            customIcon: (icon: string) => HTMLElement
            customIconTxt: (icon: string) => string
        }
    }
}

type QuestionType = 'reading' | 'meaning' | 'both'

type FlagData = {
    [name: string]: {
        color: string,
        questionType: QuestionType,
        shortText: string,
        longText: string,
    }
}

type FlaggerData = {
    dataVersion: string,
    availableFlags: FlagData,
    itemFlagMap: {
        [id: string]: string
    }
}

type EditingState = 'initial' | 'editing' | 'edited' | 'adding' | 'added' | 'deleting' | 'deleted'

type StateData = {
    [id: string]: {
        state: EditingState,
        color: string,
        longText: string,
        name: string,
        initialName: string,
        questionType: QuestionType,
    }
}

(function () {
    'use strict';

    /* global wkof, Icons2 */
    const { wkof, Icons2 } = unsafeWindow || window

    const cacheFilename = "wkFlaggerData"
    const cacheFileVersion = "2.1"
    const scriptId = "wkFlagger"
    const scriptName = "WF Flagger"

    let globalEditingState = false
    let previousStateMap: StateData = {}
    let oldFlaggerData: {[id: string]: string} = {}
    let wkFlaggerData: FlaggerData = {
        dataVersion: cacheFileVersion,
        availableFlags: {},
        itemFlagMap: {} // map of item id -> flag name
    }

    const defaultFlags = {
        red: {color: "#ff4444", questionType: "both", shortText: "A default value. Change me!", longText: ""},
        orange: {color: "#ffa500", questionType: "both", shortText: "A default value. Change me!", longText: ""},
        blue: {color: "#4444ff", questionType: "both", shortText: "A default value. Change me!", longText: ""},
        yellow: {color: "#ffff44", questionType: "both", shortText: "A default value. Change me!", longText: ""},
        purple: {color: "#7722aa", questionType: "both", shortText: "A default value. Change me!", longText: ""},
        green: {color: "#44ff44", questionType: "both", shortText: "A default value. Change me!", longText: ""},
        silver: {color: "#c0c0c0", questionType: "both", shortText: "A default value. Change me!", longText: ""},
        cyan: {color: "#44ffff", questionType: "both", shortText: "A default value. Change me!", longText: ""},
        magenta: {color: "#ff44ff", questionType: "both", shortText: "A default value. Change me!", longText: ""},
    }

    // Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.
    Icons2.addCustomIcons([
        [
            'flag-empty',
            "M48 24C48 10.7 37.3 0 24 0S0 10.7 0 24V64 350.5 400v88c0 13.3 10.7 24 24 24s24-10.7 24-24V388l80.3-20.1c41.1-10.3 84.6-5.5 122.5 13.4c44.2 22.1 95.5 24.8 141.7 7.4l34.7-13c12.5-4.7 20.8-16.6 20.8-30V66.1c0-23-24.2-38-44.8-27.7l-9.6 4.8c-46.3 23.2-100.8 23.2-147.1 0c-35.1-17.6-75.4-22-113.5-12.5L48 52V24zm0 77.5l96.6-24.2c27-6.7 55.5-3.6 80.4 8.8c54.9 27.4 118.7 29.7 175 6.8V334.7l-24.4 9.1c-33.7 12.6-71.2 10.7-103.4-5.4c-48.2-24.1-103.3-30.1-155.6-17.1L48 338.5v-237z",
            [448, 512],
        ],
        [
            'flag',
            "M64 32C64 14.3 49.7 0 32 0S0 14.3 0 32V64 368 480c0 17.7 14.3 32 32 32s32-14.3 32-32V352l64.3-16.1c41.1-10.3 84.6-5.5 122.5 13.4c44.2 22.1 95.5 24.8 141.7 7.4l34.7-13c12.5-4.7 20.8-16.6 20.8-30V66.1c0-23-24.2-38-44.8-27.7l-9.6 4.8c-46.3 23.2-100.8 23.2-147.1 0c-35.1-17.6-75.4-22-113.5-12.5L64 48V32z",
            [448, 512],
        ],
        [
            'pencil',
            "M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z",
        ]
    ])

    if (!wkof) {
        alert(`${scriptName} requires Wanikani Open Framework.\nYou will now be forwarded to installation instructions.`)
        window.location.href = 'https://community.wanikani.com/t/instructions-installing-wanikani-open-framework/28549'
        return
    }

    // Build our settings dialog and inject it into the page
    let settingsDialog = document.createElement("dialog")
    settingsDialog.setAttribute("id", "wk-flagger-settings")
    let dialogHTML = `
    <div class="flagger-settings-header">
      <h2 class="flagger-settings-title">${scriptName} Settings</h2>
    </div>
    <div class="flagger-settings-content">
      <div class="flagger-settings-content__explanation">
        <p>The following are the flag colors and matching explanations that you have set up. You can click the pencil icon next to any entry to edit the text. Please note that there is a character limit for the explanations to be displayed in the tooltip at the bottom of the review page. By default, this short explanation also becomes the hover text for each line. If you wish to enter the hover text separately, you can check the "Enter Hover text separately" option. This is useful for writing in longer descriptions than what can fit.</p>
        <div class="flagger-settings-content__option-container">
          <input type="checkbox">
          <span>Enter Hover text separately</span>
        </div>
      </div>
      <div class="flagger-settings-content__flag-list">
      </div>
    </div>
    <div class="flagger-settings__buttons">
      <div class="flagger-settings__button">
        <button class="wk-button flagger-settings__button--close">Close</button>
      </div>
      <div class="flagger-settings__button">
        <button class="wk-button flagger-settings__button--save">Save</button>
      </div>
    </div>
    `
    settingsDialog.innerHTML = dialogHTML

    function injectSettingsDialog() {
        document.body.prepend(settingsDialog)

        let settingsHoverCheckbox = document.querySelector('.flagger-settings-content__option-container input[type="checkbox"]') as HTMLInputElement
        settingsHoverCheckbox?.addEventListener('change', toggleHidden)

        let settingsCloseButton = document.querySelector('.flagger-settings__button--close')
        let settingsSaveButton = document.querySelector('.flagger-settings__button--save')

        settingsCloseButton?.addEventListener('click', closeSettingsDialog)
        settingsSaveButton?.addEventListener('click', saveAndCommit)
    }

    const statisticsClass = ".character-header__menu-statistics"
    const characterTextClass = ".character-header__characters"
    const footerClass = ".quiz-footer__content"

    // "why are we including Settings even though we don't ever use it?" you ask?
    // because the order of the menu items (Open, Settings) flips if we don't
    // this is indicative of an issue with Open Framework, not this script
    wkof.include('Settings,Menu')
    wkof.ready('Settings,Menu').then(insertMenu)

    function init() {
        insertCss()
        injectSettingsDialog()
        if (window.location.pathname === "/subjects/review") {
            createFlagDropdown()
            updateShownFlag()
            createFlagLegend()
        }
    }

    function evalObjectFalsy(obj: Object): Object | false {
        if (obj == null) return obj // will evaluate to falsy
        if (typeof obj !== 'object') throw TypeError
        for (const prop in obj) {
            if (Object.hasOwn(obj, prop)) return obj // will not evaluate to falsy
        }
        return false // is empty object so return false to treat as falsy
    }

    // TODO make sure init does not run if the error is caught
    wkof.file_cache.load(cacheFilename).then(handleCacheLoad)
        .catch(() => wkof.file_cache.save(cacheFilename, {dataVersion: "0.0", availableFlags: defaultFlags, itemFlagMap: {}}))
        .then(() => init())

    // Compact version comparison function from sinyaven's Info Injector script
    // Since we're the ones writing the cache version number, no need to handle complex semver
    function isNewerThan(otherVersion: string): boolean {
        if (!otherVersion) return true
        let v1 = cacheFileVersion.split(`.`).map(n => parseInt(n));
		let v2 = otherVersion.split(`.`).map(n => parseInt(n));
		return v1.reduce<boolean | null>((prevVal, currVal, currIndex) => prevVal ?? (currVal === v2[currIndex] ? null : (currVal > (v2[currIndex] || 0))), null) || false;
    }
    
    function handleCacheLoad(data: any) {
        if (!Object.hasOwn(data, 'dataVersion') || isNewerThan(data.dataVersion as string ?? '')) {
            let newShapedData: FlaggerData = {
                dataVersion: cacheFileVersion,
                availableFlags: evalObjectFalsy(data.availableFlags) as {[name: string]: any} | false || defaultFlags as FlagData, // if falsy, set default flags
                itemFlagMap: data.itemFlagMap ?? data // if nullish we should be migrating data, otherwise take value of itemFlagMap even if empty
            }

            // From Stackoverflow - https://stackoverflow.com/a/3627747 - CC BY-SA 4.0
            const rgbaToHex = (rgba: string) => {
                return `#${rgba.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)$/)?.slice(1)
                            .map((n, i) => (i === 3 ? Math.round(parseFloat(n) * 255) : parseFloat(n)).toString(16).padStart(2, '0').replace('NaN', ''))
                            .join('')}`
            }

            const sanitizeColors = (listOfFlags: FlagData) => {
                let flagTuples = Object.entries(listOfFlags)
                let tmpdiv = document.createElement('div')
                document.body.appendChild(tmpdiv)
                for (let [key, {color, ...rest}] of flagTuples) {
                    if (!color.startsWith('#') || color.length !== 7) {
                        tmpdiv.style.color = color
                        let rawhex = rgbaToHex(getComputedStyle(tmpdiv).color)
                        if (rawhex.length > 7) rawhex = rawhex.slice(0, 7)
                        listOfFlags[key].color = rawhex
                    }
                }
                tmpdiv.remove()
                return listOfFlags
            }

            newShapedData.availableFlags = sanitizeColors(newShapedData.availableFlags)

            wkFlaggerData = newShapedData
            wkof.file_cache.save(cacheFilename, newShapedData)

            // temporary while testing
            oldFlaggerData = data
            wkof.file_cache.save(`${cacheFilename}.old`, oldFlaggerData)
        }
        else {
            // if availableFlags evals to falsy then use the default flags for this run of the script
            if (!evalObjectFalsy(data.availableFlags)) data.availableFlags = defaultFlags
            wkFlaggerData = data
        }
    }

    function insertMenu() {
        const config = {
            name: scriptId,
            submenu: 'Settings',
            title: scriptName,
            on_click: showSettingsDialog,
        }

        wkof.Menu.insert_script_link(config)
    }

    function toggleEditing(event: Event, isBeingSaved: boolean = false) {
        let flagName = (event.currentTarget as HTMLElement).dataset.forFlag // currentTarget should be the button that was pressed, save/cancel; for-flag will be *new* name if it was changed
        if (!flagName) return

        let elementsToChange = document.querySelectorAll(`.flagger-settings-content__list-row:has([data-for-flag="${flagName}"])`)
        let inputElement: HTMLInputElement | undefined
        let shortDescriptionInput: HTMLInputElement | undefined

        const hoverTextCheckbox = document.querySelector('.flagger-settings-content__option-container input') as HTMLInputElement

        const savedPreviousState: EditingState = previousStateMap[flagName].state // used only in the case that we are going from 'editing' -> 'initial' via cancelation
        
        for (let container of elementsToChange as NodeListOf<HTMLElement>) {
            let currentState = container.dataset.state as EditingState // the state BEFORE being toggled

            // if the current row is in the adding state, the user clicked the cancel button, and it was never saved before
            if (currentState === 'adding' && !isBeingSaved && flagName.includes('naeneigja')) {
                container.remove()
                continue
            }

            // NOTE: if currentState is adding and this is not the cancel button, then flagName will NOT include naeneigja, it will be the newly chosen name

            // the current state will become the previous state after this function
            if (previousStateMap[flagName].state !== currentState) {
                previousStateMap[flagName].state = currentState
            }

            for (let child of container.childNodes as NodeListOf<HTMLElement>) {
                if ((child.tagName === 'SVG' && child.classList.contains('wk-flagger__flag')) || (child.tagName === 'LABEL' && child.firstChild?.nodeName === 'SVG')) {
                    if (!['adding', 'editing'].includes(currentState)) {
                        // wrap icon in a label for color picker input
                        let wrapperLabel = document.createElement('label')
                        wrapperLabel.setAttribute('for', `${flagName}-flag-color-picker`)
                        wrapperLabel.addEventListener('click', (event: Event) => {
                            let colorInput = wrapperLabel.nextSibling as HTMLInputElement
                            colorInput.showPicker()
                        })
                        wrapperLabel.appendChild(child)

                        container.insertBefore(wrapperLabel, container.firstChild)
                    }
                    else { // unwrap icon because we are toggling adding/editing off, remember to reset flag color if not being saved
                        let wrapperLabel = child
                        let icon = wrapperLabel.firstChild as HTMLElement

                        if (!isBeingSaved) {
                            icon.dataset.colorValue = previousStateMap[flagName].color
                            if (savedPreviousState === 'initial') icon.style.cssText = ""
                        }
                        
                        container.insertBefore(icon, wrapperLabel)
                        wrapperLabel.remove()
                    }
                }
                
                if (['INPUT', 'SELECT'].includes(child.tagName) && ['initial', 'added', 'edited'].includes(currentState)) {
                    if (child.tagName === 'SELECT') {
                        (child as HTMLSelectElement).value = previousStateMap[flagName].questionType
                    }
                    else {
                        inputElement = child as HTMLInputElement
                        
                        // the following if statements act like a switch, so we emulate the `break;` with `continue;` (which we can only do because nothing comes after this in the inner loop)

                        if (inputElement.id.includes('color-picker')) { inputElement.value = previousStateMap[flagName].color; continue; }

                        // fill in input's value with span's value if it is the short-text input
                        if (inputElement.id.includes('short-text')) {
                            shortDescriptionInput = inputElement
                            inputElement.value = Array.from(container.childNodes).find(el => el.nodeName === 'SPAN')?.textContent ?? ''
                            // @ts-ignore implicit conversion from string to number to string
                            inputElement.nextElementSibling.textContent = (inputElement.getAttribute('maxlength') ?? 40) - inputElement.value.length // set counter
                            continue
                        }

                        if (inputElement.id.includes('flag-name')) { inputElement.value = flagName; continue; }

                        if (inputElement.id.includes('flag-hover')) { inputElement.value = previousStateMap[flagName].longText; continue; }
                    }
                }
                else if (['INPUT', 'SELECT'].includes(child.tagName) && ['adding', 'editing'].includes(currentState)) {
                    if (child.tagName === 'SELECT') {
                        if (isBeingSaved) previousStateMap[flagName].questionType = (child as HTMLSelectElement).value as QuestionType
                        else (child as HTMLSelectElement).value = previousStateMap[flagName].questionType
                    }
                    else {
                        inputElement = child as HTMLInputElement
                        if (isBeingSaved) {
                            // can't just use inputElement.value here because the color picker might reset its value
                            // @ts-ignore we are selecting the icon with the data attribute so it will not have an undefined value; selector will not return undefined as there must be an icon with this data attribute
                            if (inputElement.id.includes('color-picker')) { previousStateMap[flagName].color = (container.querySelector('i[data-color-value]') as HTMLElement).dataset.colorValue; continue; }

                            if (inputElement.id.includes('flag-name') && previousStateMap[flagName].name !== flagName) {
                                let oldName = previousStateMap[flagName].name
                                previousStateMap[flagName].name = flagName
                                delete previousStateMap[oldName]
                                continue
                            }

                            if (inputElement.id.includes('flag-hover')) { previousStateMap[flagName].longText = inputElement.value; continue; }
                        }
                        else {
                            if (inputElement.id.includes('color-picker')) { inputElement.value = previousStateMap[flagName].color; continue; }
                            if (inputElement.id.includes('short-text')) { inputElement.value = ""; continue; }
                            if (inputElement.id.includes('flag-hover')) { inputElement.value = previousStateMap[flagName].longText; continue; }
                        }
                    }
                }
            }

            if (container.dataset.hoverTextHidden != null) {
                container.dataset.hoverTextHidden = `${!hoverTextCheckbox.checked}` // wrapped in template to please typescript
            }

            if (currentState === 'editing') {
                container.dataset.state = isBeingSaved ? 'edited' : savedPreviousState
            }
            else if (currentState === 'adding') {
                // if currentState is 'adding' and it is not being saved, then it can either go back to 'added' or the row is deleted (which happens before we ever get here)
                // if we ARE saving, then we must go to 'added'
                container.dataset.state = 'added'
            }
            else {
                container.dataset.state = currentState === 'added' ? 'adding' : 'editing'
            }
        }

        // if after toggling editing on a single row all rows are not in the initial state then the global editing state should be true
        let allRows: NodeListOf<HTMLElement> = document.querySelectorAll('#wk-flagger-settings [data-state]')
        globalEditingState = Array.from(allRows).some((row) => row.dataset.state as EditingState !== 'initial')

        shortDescriptionInput?.focus()
    }

    function toggleDeletingState(event: Event) {
        let mainRows: HTMLElement[] = Array.from(document.querySelectorAll('#wk-flagger-settings [data-state]') as NodeListOf<HTMLElement>).filter((row) => row.classList.length === 1)
        let markForDeleteButton = document.querySelector('#wk-flagger-settings .flagger-settings-content__list-row--button-delete') as HTMLButtonElement
        let addNewFlagButton = document.querySelector('#wk-flagger-settings .flagger-settings-content__list-row--button-add') as HTMLButtonElement

        for (let row of mainRows) {
            let flagName = row.dataset.forFlag
            if (!flagName) continue
            
            // get other two rows with same flag name
            let siblingRows = [
                row.parentElement?.querySelector(`.flagger-settings-content__list-row--flag-info[data-for-flag="${flagName}"]`) as HTMLElement,
                row.parentElement?.querySelector(`.flagger-settings-content__list-row--hover-text[data-for-flag="${flagName}"]`) as HTMLElement
            ]

            if (siblingRows.some(row => row == null)) {
                // error
                continue
            }

            if (row.dataset.state as EditingState === 'deleted') {
                let checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement
                checkbox.disabled = !checkbox.disabled
            }
            else if (row.dataset.state as EditingState === 'deleting') {
                row.dataset.state = siblingRows[0].dataset.state = siblingRows[1].dataset.state = previousStateMap[flagName].state
                previousStateMap[flagName].state = 'deleting'
            }
            else {
                previousStateMap[flagName].state = row.dataset.state as EditingState
                row.dataset.state = siblingRows[0].dataset.state = siblingRows[1].dataset.state = 'deleting'
            }
        }

        if (!addNewFlagButton || !markForDeleteButton) {
            // throw some kind of error (don't use `throw`) and handle it
            return
        }

        markForDeleteButton.textContent = addNewFlagButton.checkVisibility() ? 'Confirm Selected' : 'Mark Flags for Deletion'
        // taking advantage of some default css from wanikani wherein `[hidden] { display: none !important; }`
        addNewFlagButton.hidden = addNewFlagButton.checkVisibility()

        globalEditingState = Array.from(mainRows).some((row) => row.dataset.state as EditingState !== 'initial')
    }

    function toggleDeletedState(event: Event) {
        let currentRow = (event.currentTarget as HTMLElement).parentElement
        if (!globalEditingState || !currentRow || currentRow.dataset.state as EditingState !== 'deleting') return
        let currentFlag = currentRow.dataset.forFlag
        let flagRows: NodeListOf<HTMLElement> = document.querySelectorAll(`#wk-flagger-settings [data-state][data-for-flag="${currentFlag}"]`)
        flagRows.forEach((row) => {
            row.dataset.state = 'deleted'
        })
    }

    function toggleHidden(event: Event) {
        // get all rows with data-state editing or adding and data-hover-text-hidden (true or false; they should all be the same value but that's not enforced)
        let settingsDialog = document.getElementById('wk-flagger-settings')
        let toggleableHoverTextRows: NodeListOf<HTMLElement> | undefined = settingsDialog?.querySelectorAll('.flagger-settings-content__list-row[data-state="editing"][data-hover-text-hidden], .flagger-settings-content__list-row[data-state="adding"][data-hover-text-hidden]')

        if (toggleableHoverTextRows && toggleableHoverTextRows.length > 0) {
            toggleableHoverTextRows.forEach(row => {
                row.dataset.hoverTextHidden = `${row.dataset.hoverTextHidden !== 'true'}` // wrapped in template to please typescript
            })
        }
    }

    function saveRowChanges(this: HTMLElement, event: Event) {
        let containerRow = this.parentElement
        if (!containerRow) return
        let currentState = containerRow.dataset.state as EditingState
        if (!globalEditingState || !['adding', 'editing'].includes(currentState)) return // TODO do something else useful instead of returning

        let currentFlagName = containerRow.dataset.forFlag

        let flagNameInput = containerRow.nextElementSibling?.querySelector('input[name*="flag-name"]') as HTMLInputElement
        if (!flagNameInput) return

        let shortTextInput = containerRow.querySelector(`#${currentFlagName}-flag-short-text`) as HTMLInputElement

        if (!shortTextInput.checkValidity()) {
            alert(`The text for the short description of the ${currentFlagName?.toLocaleUpperCase} flag is too long. Please shorten it to 40 characters or less.\n(Note: some characters are actually worth 2 or more to a computer. Please take this into account.)`)
            shortTextInput.focus()
            return
        }

        if (flagNameInput.value.includes('naeneigja')) {
            // TODO alert user name cannot include this word
            flagNameInput.focus()
            return
        }

        if (currentFlagName && flagNameInput.value !== currentFlagName) {
            let oldFlagName = currentFlagName            
            currentFlagName = flagNameInput.value // TODO wrap in function to normalize input | might not be needed if I instead have an event listener normalize on defocus

            if (currentFlagName in wkFlaggerData.availableFlags) {
                return // TODO error: we cannot set a flag's new name to an existing flag's name
            }

            if (!(currentFlagName in previousStateMap) && oldFlagName.includes('naeneigja')) {
                previousStateMap[currentFlagName] = {state: 'initial', color: '', longText: '', name: oldFlagName, initialName: oldFlagName, questionType: 'both'}
            }
            else if (!(currentFlagName in previousStateMap)) {
                previousStateMap[currentFlagName] = Object.assign({}, previousStateMap[oldFlagName], {name: oldFlagName})
            }
            else {
                return // this would be an error, as a new name should not be in the previous state map
            }

            replaceFlagNameOnElements(oldFlagName, currentFlagName)
        }
        else if (!currentFlagName) {
            return
        }

        // remember to set the span's content to the newly input value
        (shortTextInput.previousElementSibling as HTMLSpanElement).textContent = shortTextInput.value

        toggleEditing.bind(this)(event, true)
    }

    function replaceFlagNameOnElements(nameToReplace:string, replacementName:string) {
        let elementsToChange: NodeListOf<HTMLElement> = document.querySelectorAll(`#wk-flagger-settings [data-for-flag="${nameToReplace}"], #wk-flagger-settings label[for*="${nameToReplace}"]`)

        for(let el of elementsToChange) {
            if (!replacementName) break
            el.dataset.forFlag = replacementName
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
                el.id = el.id.replace(nameToReplace, replacementName);
                (el as HTMLInputElement | HTMLSelectElement).name = (el as HTMLInputElement | HTMLSelectElement).name.replace(nameToReplace, replacementName);
            }
            if (el.tagName === 'LABEL') {
                let valueOfFor = el.getAttribute('for')
                if (valueOfFor) {
                    if (valueOfFor.includes('color-picker')) {
                        let icon = el.firstElementChild as HTMLElement
                        icon.dataset.forFlag = replacementName
                    }
                    el.setAttribute('for', `${valueOfFor.replace(nameToReplace, replacementName)}`)
                }
            }
        }
    }

    function saveAndCommit(event: Event) {
        // TODO
        // check that we are in the editing state before saving (the global editing state variable is true)
        //   if any elements have data-state = 'deleting', toggleDeleting off
        //   if no elements have data-state = 'edited', 'deleted', 'added', 'adding', or 'editing', simply close the dialog
        //   if no elements have data-state = 'edited', 'deleted', or 'added' but some do have 'editing' or 'adding', then call saveRowChanges for each row still in 'editing' or 'adding'
        //   we should now have elements with data-state = 'edited', 'deleted', or 'added' and none with 'editing' or 'adding'
        // get the values of the inputs/flags with data-state = 'edited', use their data-for-flag value and the presence of the name attribute containing flag-hover to know which flag to update and whether to update hover text
        //   add the flags to be updated to its own list
        // get the values of the inputs/flags with data-state = 'added', ...
        //   add to their own list
        // get the flag names of the rows that have been marked for deletion and check if that flag name has any values using it in the map
        //   if values using the flag name exist in the map, delay deletion, alert user and prompt them for a replacement value if desired, allow them to select no replacement and inform this will remove the items from the map
        //   add flags to be deleted to another separate list
        // check that no flags in update list are in delete list OR make sure user understands delete trumps update
        // check that no flags in addition list are in availableFlags already; for the ones that are, add them to the update list so the values can be updated, inform the user
        // check that flags in delete list are in availableFlags; for the ones that aren't, remove the related rows with no need to do a cache operation
        // save a copy of the data object before operations for rollback
        // do updates first, going through flags to update and finding them in the data, updating their values
        // spread new flags into availableFlags, also add flags that had their names changed as new flags then delete the old entries using their initial name
        // delete item map values with flag name that will be deleted
        // delete flag from availableFlags
        // save the cache if there were no errors, if errors rollback
        // delete rows of flags that were deleted from the html
        // set all remaining rows to initial data-state
        // close the dialog
        // previousStateMap = {}
        // remove the style element for this script and call insertCSS again so that any new flags have their colors added
    }

    function addNewFlagRow(event: Event) {
        if (!globalEditingState) globalEditingState = true
        const tmpName = `naeneigja-${Math.random().toString(36).substring(2, 10)}`
        let newRows = createFlagRows([tmpName, {color: '', questionType: 'both', shortText: "A default value. Change me!", longText: ''}], true /* isAddedRow */)
        const lastRow: HTMLDivElement | null = document.querySelector('#wk-flagger-settings .flagger-settings-content__list-row--buttons')
        if (lastRow) {
            for (const row of newRows) {
                if (!(row.className.includes('--flag-info') || row.className.includes('--hover-text'))) {
                    // set up button event listeners
                    let buttons: NodeListOf<HTMLElement> = row.querySelectorAll('.flagger-settings-content__list-row-btn')
                    buttons.forEach(btn => {
                        if (btn.className.includes('--edit')) {
                            btn.addEventListener('click', toggleEditing)
                            return
                        }

                        if (btn.className.includes('--cancel')) {
                            btn.addEventListener('click', toggleEditing)
                            return
                        }

                        if (btn.className.includes('--save')) {
                            btn.addEventListener('click', saveRowChanges)
                            return
                        }
                    })
                }
                lastRow.insertAdjacentElement('beforebegin', row)
            }
        }
    }

    function showSettingsDialog() {
        settingsDialog = document.getElementById('wk-flagger-settings') as HTMLDialogElement

        // ------ Create Flag Management Buttons Row ------

        let flagManagementButtonsRow = document.createElement('div')
        flagManagementButtonsRow.setAttribute('class', `flagger-settings-content__list-row flagger-settings-content__list-row--buttons`)

        let markDeleteButtonContainer = document.createElement('div')
        markDeleteButtonContainer.classList.add('flagger-settings-content__list-row--button')

        let toggleDeleteButton = document.createElement('button')
        toggleDeleteButton.setAttribute('class', `wk-button flagger-settings-content__list-row--button-delete`)
        toggleDeleteButton.textContent = "Mark Flags for Deletion"

        toggleDeleteButton.addEventListener('click', toggleDeletingState)

        markDeleteButtonContainer.append(toggleDeleteButton)

        let addNewFlagButtonContainer = document.createElement('div')
        addNewFlagButtonContainer.classList.add('flagger-settings-content__list-row--button')

        let addNewFlagButton = document.createElement('button')
        addNewFlagButton.setAttribute('class', `wk-button flagger-settings-content__list-row--button-add`)
        addNewFlagButton.textContent = "Add a New Flag"

        addNewFlagButton.addEventListener('click', addNewFlagRow)

        addNewFlagButtonContainer.append(addNewFlagButton)

        flagManagementButtonsRow.append(markDeleteButtonContainer, addNewFlagButtonContainer)

        // ------

        let settingsContentTarget = settingsDialog.querySelector('.flagger-settings-content__flag-list')
        settingsContentTarget?.replaceChildren(...createFlagMeaningRows(), flagManagementButtonsRow)

        let settingsListRowEditButtons = document.querySelectorAll('.flagger-settings-content__list-row-btn--edit')
        let settingsListRowEditCancelButtons = document.querySelectorAll('.flagger-settings-content__list-row-btn--cancel')
        let settingsListRowEditSaveButtons = document.querySelectorAll('.flagger-settings-content__list-row-btn--save')

        settingsListRowEditButtons.forEach((button) => button.addEventListener('click', toggleEditing))
        settingsListRowEditCancelButtons.forEach((button) => button.addEventListener('click', toggleEditing))
        settingsListRowEditSaveButtons.forEach((button) => button.addEventListener('click', saveRowChanges))

        settingsDialog.showModal()
    }

    function closeSettingsDialog(event?: Event) {
        settingsDialog = document.getElementById('wk-flagger-settings') as HTMLDialogElement

        if (globalEditingState) {
            if (confirm(`You have unsaved changes. Are you sure you wish to close the settings without saving?`)) {
                previousStateMap = {}
                settingsDialog.close()
            }
            else return
        }

        previousStateMap = {}
        settingsDialog.close()
    }

    function createFlagRows(flagPair: [string, FlagData["name"]], isAddedFlagRow: boolean = false) {
        const classNamespace = "flagger-settings-content__"
        const startingState = isAddedFlagRow ? 'adding' : 'initial'
        let flagName = flagPair[0]
        let {color: flagCssValue, questionType: flagQuestionType, shortText: flagShortText, longText: flagHoverText} = flagPair[1]
        previousStateMap[flagName] = {state: startingState, color: flagCssValue, longText: flagHoverText, name: flagName, initialName: flagName, questionType: flagQuestionType}

        // ------ Short Text Row ------

        let shortTextRow = document.createElement('div')
        shortTextRow.setAttribute('class', `${classNamespace}list-row`)
        shortTextRow.setAttribute('data-for-flag', flagName)
        shortTextRow.setAttribute('data-state', startingState)

        let flagIcon: HTMLElement
        if (!isAddedFlagRow) {
            flagIcon = Icons2.customIcon('flag')
            flagIcon.classList.add(`wk-flagger__flag wk-flagger__flag--${flagName}`)
        }
        else {
            flagIcon = Icons2.customIcon('flag-empty')
            flagIcon.classList.add(`wk-flagger__flag`)
        }
        flagIcon.setAttribute('data-color-value', `${flagCssValue}`)
        flagIcon.setAttribute('data-for-flag', flagName)

        let flagIconLabel: HTMLLabelElement | undefined
        if (isAddedFlagRow) {
            flagIconLabel = document.createElement('label')
            flagIconLabel.setAttribute('for', `${flagName}-flag-color-picker`)
            flagIconLabel.addEventListener('click', (event: Event) => {
                let colorInput = (event.currentTarget as HTMLLabelElement).nextSibling as HTMLInputElement
                colorInput.showPicker()
            })
            flagIconLabel.appendChild(flagIcon)
        }

        let flagColorPicker = document.createElement('input')
        flagColorPicker.type = "color"
        flagColorPicker.id = `${flagName}-flag-color-picker`
        flagColorPicker.name = `${flagName}-flag-color-picker`
        flagColorPicker.setAttribute('data-for-flag', flagName)
        flagColorPicker.style.cssText = "display: none !important;"
        if (!isAddedFlagRow) flagColorPicker.value = flagCssValue

        flagColorPicker.addEventListener('change', function(event: Event) {
            let colorPicker = event.target as HTMLInputElement
            let flagName = colorPicker.dataset.forFlag
            let flagInRow = colorPicker.parentNode?.querySelector(`i[data-for-flag="${flagName}"]`) as HTMLElement
            flagInRow.dataset.colorValue = colorPicker.value
            flagInRow.style.color = colorPicker.value
        })

        let flagText = document.createElement('span')
        flagText.setAttribute('class', `${classNamespace}list-row--text`)
        flagText.setAttribute('data-for-flag', flagName)
        flagText.textContent = flagShortText

        let flagInput = document.createElement('input')
        flagInput.type = "text"
        flagInput.id = `${flagName}-flag-short-text`
        flagInput.name = `${flagName}-flag-short-text`
        flagInput.setAttribute('data-for-flag', flagName)
        flagInput.setAttribute('maxlength', '40')

        flagInput.addEventListener('input', function(event: Event) {
            let flagName = (event.target as HTMLInputElement).dataset.forFlag
            let maxLength = (event.target as HTMLInputElement).getAttribute('maxlength') ?? 40
            let boundCounter = document.querySelector(`.flagger-settings-content__counter[data-for-flag="${flagName}"]`)
            if (boundCounter) {
                // @ts-ignore implicit conversion from string to number to string
                boundCounter.textContent = maxLength - this.value.length
                if (this.value.length <= 15) {
                    boundCounter.classList.remove('color-warn', 'color-alert')
                    boundCounter.classList.add('color-ok')
                }
                else if (this.value.length <= 30) {
                    boundCounter.classList.remove('color-ok', 'color-alert')
                    boundCounter.classList.add('color-warn')
                }
                else {
                    boundCounter.classList.remove('color-ok', 'color-warn')
                    boundCounter.classList.add('color-alert')
                }
            }
        })

        let flagInputLengthCounter = document.createElement('div')
        flagInputLengthCounter.setAttribute('data-for-flag', flagName)
        flagInputLengthCounter.setAttribute('class', `${classNamespace}counter`)

        if (flagShortText.length <= 15) flagInputLengthCounter.classList.add('color-ok')
        else if (flagShortText.length <= 30) flagInputLengthCounter.classList.add('color-warn')
        else flagInputLengthCounter.classList.add('color-alert')

        if (isAddedFlagRow) {
            flagInput.value = flagShortText
            // @ts-ignore implicit conversion
            flagInputLengthCounter.textContent = 40 - flagShortText.length
        }

        let deleteCheckbox = document.createElement('input')
        deleteCheckbox.type = "checkbox"
        deleteCheckbox.id = `${flagName}-flag-selection`
        deleteCheckbox.name = `${flagName}-flag-selection`
        deleteCheckbox.setAttribute('data-for-flag', flagName)

        deleteCheckbox.addEventListener('input', toggleDeletedState)

        let cancelIcon = Icons2.customIcon('cross')
        cancelIcon.classList.add(`${classNamespace}list-row-btn`, `${classNamespace}list-row-btn--cancel`)
        cancelIcon.setAttribute('data-for-flag', flagName)

        let saveIcon = Icons2.customIcon('check')
        saveIcon.classList.add(`${classNamespace}list-row-btn`, `${classNamespace}list-row-btn--save`)
        saveIcon.setAttribute('data-for-flag', flagName)

        let editIcon = Icons2.customIcon('pencil')
        editIcon.classList.add(`${classNamespace}list-row-btn`, `${classNamespace}list-row-btn--edit`)
        editIcon.setAttribute('data-for-flag', flagName)

        shortTextRow.append(flagIconLabel || flagIcon, flagColorPicker, flagText, flagInput, flagInputLengthCounter, deleteCheckbox, cancelIcon, saveIcon, editIcon)

        // ------ Flag Info Row ------

        let flagInfoRow = document.createElement('div')
        flagInfoRow.setAttribute('class', `${classNamespace}list-row ${classNamespace}list-row--flag-info`)
        flagInfoRow.setAttribute('data-for-flag', flagName)
        flagInfoRow.setAttribute('data-state', startingState)

        let flagInfoNameLabel = document.createElement('label')
        flagInfoNameLabel.setAttribute('class', `${classNamespace}label`)
        flagInfoNameLabel.setAttribute('for', `${flagName}-flag-name`)
        flagInfoNameLabel.textContent = "Flag Name:"

        let flagInfoNameInput = document.createElement('input')
        flagInfoNameInput.type = "text"
        flagInfoNameInput.id = `${flagName}-flag-name`
        flagInfoNameInput.name = `${flagName}-flag-name`
        flagInfoNameInput.setAttribute('data-for-flag', flagName)
        flagInfoNameInput.setAttribute('maxlength', '20')
        flagInfoNameInput.value = flagName

        let flagInfoQuestionLabel = document.createElement('label')
        flagInfoQuestionLabel.setAttribute('class', `${classNamespace}label`)
        flagInfoQuestionLabel.setAttribute('for', `${flagName}-flag-display`)
        flagInfoQuestionLabel.textContent = "Show on:"

        let flagInfoQuestionSelect = document.createElement('select')
        flagInfoQuestionSelect.id = `${flagName}-flag-display`
        flagInfoQuestionSelect.name = `${flagName}-flag-display`
        flagInfoQuestionSelect.setAttribute('data-for-flag', flagName)

        let optionHTML = `<option value="both">Reading &amp; Meaning</option>\n<option value="reading">Reading Only</option>\n<option value="meaning">Meaning Only</option>`
        flagInfoQuestionSelect.insertAdjacentHTML('afterbegin', optionHTML)

        flagInfoQuestionSelect.value = flagQuestionType

        flagInfoRow.append(flagInfoNameLabel, flagInfoNameInput, flagInfoQuestionLabel, flagInfoQuestionSelect)

        // ------ Hover Text Row ------

        let hoverTextRow = document.createElement('div')
        hoverTextRow.setAttribute('class', `${classNamespace}list-row ${classNamespace}list-row--hover-text`)
        hoverTextRow.setAttribute('data-for-flag', `${flagName}`)
        hoverTextRow.setAttribute('data-state', startingState)
        hoverTextRow.setAttribute('data-hover-text-hidden', "true") // used in conjunction with hover text checkbox

        let hoverTextLabel = document.createElement('label')
        hoverTextLabel.setAttribute('class', `${classNamespace}label`)
        hoverTextLabel.setAttribute('for', `${flagName}-flag-hover`)
        hoverTextLabel.textContent = "Hover Text:"

        let hoverTextInput = document.createElement('input')
        hoverTextInput.type = "text"
        hoverTextInput.id = `${flagName}-flag-hover`
        hoverTextInput.name = `${flagName}-flag-hover`
        hoverTextInput.placeholder = 'Enter hover text here'
        hoverTextInput.setAttribute('data-for-flag', `${flagName}`)
        hoverTextInput.value = flagHoverText

        hoverTextRow.append(hoverTextLabel, hoverTextInput)

        return [shortTextRow, flagInfoRow, hoverTextRow]
    }

    function createFlagMeaningRows(): HTMLElement[] {
        let rowList = [] as HTMLElement[]

        for (const flagPair of Object.entries(wkFlaggerData.availableFlags)) {
            rowList.push(...createFlagRows(flagPair))
        }

        return rowList
    }

    function updateShownFlag() {
        if (window.location.pathname !== "/subjects/review") return

        const itemId = getCurrentItemId()
        const flagElement = document.querySelector(".wk-flagger__flag--button")

        if (!flagElement) {
            alert("WK Flagger: Something went wrong! The flag dropdown is missing.")
            return
        }

        const color = wkFlaggerData.itemFlagMap[itemId]
        flagElement.setAttribute("class", "wk-flagger__flag wk-flagger__flag--button")
        if (color === undefined) {
            flagElement.innerHTML = createFlag().innerHTML
        } else {
            flagElement.classList.add(`wk-flagger__flag--${color}`)
        }
    }

    function createFlag(className?: string | undefined, isEmpty: boolean = false) {
        const flagElement = Icons2.customIcon(`flag${isEmpty ? '-empty' : ''}`)
        flagElement.classList.add("wk-flagger__flag")
        if (className) flagElement.classList.add(`wk-flagger__flag--${className}`)
        return flagElement
    }

    function createFlagLegend() {
        if (window.location.pathname !== "/subjects/review") return

        if (document.querySelector(".wk-flagger__flag-labels-button")) return

        const footerContent = document.querySelector(footerClass)

        if (!footerContent) return

        // create the legend via createElement calls instead of writing out all the html

        let legendButton = document.createElement('a')
        legendButton.classList.add(`wk-flagger__flag-labels-button`, `quiz-footer__button`)
        legendButton.setAttribute('data-expanded', "false")

        // ----- Header ----- //

        let legendHeader = document.createElement('div')
        legendHeader.classList.add(`wk-flagger__flag-labels--header`)
        legendHeader.title = "WK Flagger Labels"

        let headerFlag = createFlag()
        headerFlag.classList.add(`wk-flagger__flag-labels--header-icon`)
        headerFlag.ariaHidden = "true"

        let legendHeaderText = document.createElement('span')
        legendHeaderText.classList.add(`wk-flagger__flag-labels--header-text`)
        legendHeaderText.textContent = "Flag Labels"

        legendHeader.append(headerFlag, legendHeaderText)

        // ----- Content ----- //

        let legendContentWrapper = document.createElement('div')
        legendContentWrapper.classList.add(`wk-flagger__flag-labels--content`)

        const createLegendEntry = (flagName: string) => {
            const questionTypeMap = {
                reading: 'R',
                meaning: 'M',
                both: 'R/M'
            }

            let entryWrapper = document.createElement('div')
            entryWrapper.classList.add(`wk-flagger__flag-labels--entry`)

            let entryFlagWrapper = document.createElement('div')
            entryFlagWrapper.classList.add(`wk-flagger__flag-labels--flags`)

            let entryFlag = document.createElement('div')
            entryFlag.classList.add(`wk-flagger__flag-labels--flag`)

            let flagIcon = createFlag(flagName)

            entryFlag.append(flagIcon)
            entryFlagWrapper.append(entryFlag)

            let entryDisplayTypeElement = document.createElement('div')
            entryDisplayTypeElement.classList.add(`wk-flagger__flag-labels--display-type`)
            entryDisplayTypeElement.textContent = questionTypeMap[wkFlaggerData.availableFlags[flagName].questionType]

            let entryShortDescriptionElement = document.createElement('div')
            entryShortDescriptionElement.classList.add(`wk-flagger__flag-labels--label`)
            entryShortDescriptionElement.title = wkFlaggerData.availableFlags[flagName].longText || wkFlaggerData.availableFlags[flagName].shortText
            entryShortDescriptionElement.textContent = wkFlaggerData.availableFlags[flagName].shortText

            entryWrapper.append(entryFlagWrapper, entryDisplayTypeElement, entryShortDescriptionElement)

            return entryWrapper
        }

        legendContentWrapper.append(...Object.keys(wkFlaggerData.availableFlags).map(color => createLegendEntry(color)))

        legendButton.append(legendHeader, legendContentWrapper)

        legendButton.addEventListener('click', (event: Event) => {
            let legend = event.currentTarget as HTMLElement

            legend.dataset.expanded = `${legend.dataset.expanded !== 'true'}` // wrapped in template to please typescript
        })

        footerContent.prepend(legendButton)
    }

    function createFlagDropdown() {
        if (window.location.pathname !== "/subjects/review") return

        if (document.querySelector(".wk-flagger__wrapper")) return

        const statisticsElement = document.querySelector(statisticsClass)

        const flagElementWrapper = document.createElement("div")
        flagElementWrapper.classList.add("wk-flagger__wrapper")

        const flagElement = createFlag("button", true)
        flagElement.addEventListener("click", () => toggleDropdown())

        flagElementWrapper.append(flagElement)
        statisticsElement?.prepend(flagElementWrapper)

        const dropdownElement = document.createElement("div")
        dropdownElement.classList.add("wk-flagger__dropdown")
        flagElementWrapper.append(dropdownElement)

        const dropdownNoFlag = createFlag("no-flag", true)
        dropdownNoFlag.addEventListener("click", () => {
            setFlagForCurrentItem(undefined)
            toggleDropdown(false)
            updateShownFlag()
        })

        const dropdownColoredFlags = Object.keys(wkFlaggerData.availableFlags).map((name) => {
            const flag = createFlag(name)
            flag.addEventListener("click", () => {
                setFlagForCurrentItem(name)
                toggleDropdown(false)
                updateShownFlag()
            })

            return flag
        })

        dropdownElement.append(dropdownNoFlag, ...dropdownColoredFlags)

        const changeObserver = new MutationObserver(updateShownFlag)
        const target = document.querySelector(characterTextClass)
        if (target) {
            changeObserver.observe(
                target,
                { characterData: true, childList: true },
            )
        }
    }

    function insertCss(refresh = false) {
        const flagColors = `${statisticsClass} .wk-flagger__wrapper, #wk-flagger-settings, .wk-flagger__flag-labels-button {\n${Object.entries(wkFlaggerData.availableFlags).map((kvp) => {
            return `  .wk-flagger__flag--${kvp[0]} { fill: ${kvp[1].color}; }`
        }).join('\n')}\n}`

        let css = GM_getResourceText('flagger-style')
        css += `\n\n${flagColors}`

        if (refresh) {
            (document.getElementById('wk-flagger-css') as HTMLStyleElement).innerHTML = css
        }
        else {
            const styleElement = document.createElement("style")
            styleElement.id = 'wk-flagger-css'
            styleElement.innerHTML = css
            document.head.append(styleElement)
        }
    }

    function toggleDropdown(state: boolean | undefined = undefined) {
        const dropdownElement = document.querySelector(".wk-flagger__dropdown")
        
        if (!dropdownElement) return

        dropdownElement.classList.toggle("wk-flagger__dropdown--shown", state)
    }

    function setFlagForCurrentItem(flagName: string | undefined) {
        const currentId = getCurrentItemId()

        if (flagName) {
            wkFlaggerData.itemFlagMap[currentId] = flagName
        } else {
            delete wkFlaggerData.itemFlagMap[currentId]
        }

        wkof.file_cache.save(cacheFilename, wkFlaggerData)

        updateShownFlag()
    }

    function getCurrentItemId() {
        // Stolen straight from Sinyaven's awesome item info injector script - thx
        const subjects = JSON.parse(document.querySelector(`[data-quiz-queue-target="subjects"]`)?.textContent ?? "")
        const currentId: string = (document.querySelector(`[data-subject-id]`) as HTMLElement)?.dataset.subjectId ?? subjects[0]?.id

        return currentId
    }

    document.addEventListener("turbo:load", () => init())
})();