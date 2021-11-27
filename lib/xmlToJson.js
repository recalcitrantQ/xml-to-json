module.exports = traverse;

function traverse(xml,opts) {
    const attributeMode = typeof opts.attributeMode === 'undefined' ? true : opts.attributeMode
    const wrapMode = typeof opts.wrapMode === 'undefined' ? false : opts.wrapMode

    const tagFinder = new RegExp('<(.*?)[>|\\s|/]', 'g'); //find the current tag we are working on

    const json = {};
    let tagShouldBeArray = {};
    
    //recursion base case
    if(xml === '' || (xml.charAt(0) !== '<' && xml.charAt(xml.length-1) !== '>')) {
        return xml;
    }

    var currentLevelTags;
    var skip = 0;
    while((currentLevelTags = tagFinder.exec(xml)) !== null) {
        let selfClosing = false;
        const tag = currentLevelTags[1];

        const finishTag = '</'+tag+'>';
        const input = currentLevelTags.input;
        const tagLength = input.indexOf('>',skip)+1;

        const start = currentLevelTags.index;
        const end = currentLevelTags.input.indexOf('>',start)+1;
        const currentTag = currentLevelTags.input.substring(start,end);

        selfClosing = isSelfClosing(currentTag);

        if(!validate(currentTag)) {
            const err = new Error('Invalid XML tag');
            throw err;
        }
        //const closingTagIndex = input.indexOf(finishTag,tagLength);
        const closingTagIndex = findClosingIndex(input,tag,tagLength);
        if(selfClosing === false && closingTagIndex < 0) {
            const err = new Error('Invalid XML');
            throw err;
        }
        
        let substring; //substring will be either all child tags or if self closing tag just a blank string. i.e: <employee><name>Alex</name></employee> : <name>Alex</name> will be the substring of the <employee> parent tag
        if(selfClosing) {
            substring = '';
            skip = currentTag.length + skip;

        } else {
            substring = input.substring(input.indexOf('>', skip)+1, closingTagIndex);
            skip = tagLength + substring.length + finishTag.length;
        }
        

        tagFinder.lastIndex = skip; //skip all child tags of current level

        let temporary = {};
        if(attributeMode) {
            temporary = collectAttributes(currentTag);
        }

        //go one level deeper
        const next = traverse(substring,opts);
        
        //when returning from recursion, build up the json

        if(attributeMode && (wrapMode || Object.keys(temporary).length)) {
            // attributeMode is on, and either there are attributes to include or wrapMode is also on
            if (typeof next === 'object') {
                temporary = {
                    ...temporary,
                    ...next
                }
            } else {
                temporary['textNode'] = next
            }
        } else {
            // next does not include attributes
            temporary = next
        }

        if(json[tag] === undefined) {
            // this is the first time we encounter this tag at this level
            json[tag] = wrapMode ? [temporary] : temporary
        } else if (Array.isArray(json[tag])) {
            // this tag is already an array at this level
            json[tag].push(temporary)
        } else {
            // we have encountered a second instance of this tag at this level
            json[tag] = [json[tag], temporary]
        }
    }


    return json;
}




//Helper methods

//Determine if a tag is self closing or not. Could be improved
function isSelfClosing(currentTag) {
    if(currentTag.indexOf('/>') > -1) {
        return true;
    }
    return false;
}

//Collect all the attributes of the current tag and return an object in form of {attribute:values}
function collectAttributes(currentTag) {
    const attributeFinder = new RegExp('(\\S*)="(.*?)"', 'g');
    const foundAttributes = {};

    let attributes
    while((attributes = attributeFinder.exec(currentTag)) !== null) {
        const key = attributes[1];
        const value = attributes[2];

        foundAttributes[key] = value;
    }

    return foundAttributes;
}

function validate(currentTag) {
    if((currentTag.charAt(0) === '<' && currentTag.charAt(1) === '?') && (currentTag.charAt(currentTag.length-1) === '>' && currentTag.charAt(currentTag.length-2) === '?')) {
        return true;
    }

    if(currentTag.charAt(0) === '<' && (currentTag.charAt(currentTag.length-2)+currentTag.charAt(currentTag.length-1) === '/>' || currentTag.charAt(currentTag.length-1) === '>')) {
        return true;
    }

    return false;
}

function findClosingIndex(searchString, tag, start) {

    let index = start;
    const closeTag = '</' + tag + '>'
    let nextClose = searchString.indexOf(closeTag,index);
    const openPattern = new RegExp('<' + tag + '[>\\s/]', 'g');
    openPattern.lastIndex = index;
    let nextOpen = openPattern.exec(searchString);
    let pendingTags = 1;

    while(pendingTags) {
        if(nextClose < 0) {
            return nextClose;
        } else if(!nextOpen || nextClose < nextOpen.index) {
            pendingTags -= 1;
            index = nextClose;
            nextClose = searchString.indexOf(closeTag, index + 1);
        } else {
            pendingTags += 1;
            index = nextOpen.index;
            openPattern.lastIndex = index + 1;
            nextOpen = openPattern.exec(searchString);
        }
    }

    return index;
}
