// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.id = 'c0dbba103d';
squiffy.story.sections = {
	'_default': {
		'text': "<p>You wake up in a strange room.  The last thing you remember is you were doing math homework then everything gets fuzzy.  As you look around the room you see what appears to be math problems on papers taped or stapled to everything, doors, bookshelves, even the window. There is a small safe on the floor near one wall and even it has math problems taped all over it. What do you want to do?</p>\n<p>Go to the <a class=\"squiffy-link link-passage\" data-passage=\"door\" role=\"link\" tabindex=\"0\">door</a>, examine the <a class=\"squiffy-link link-passage\" data-passage=\"safe\" role=\"link\" tabindex=\"0\">safe</a>, check out the <a class=\"squiffy-link link-passage\" data-passage=\"bookshelf\" role=\"link\" tabindex=\"0\">bookshelf</a>, or go to the <a class=\"squiffy-link link-passage\" data-passage=\"window\" role=\"link\" tabindex=\"0\">window</a>?</p>",
		'passages': {
			'mainRoom': {
				'clear': true,
				'text': "<p>As you look around the room you see what appears to be math problems on papers taped to everything, doors, bookshelves, even the window. {if window: You already opened the padlock on the window.}{if safe: You unlocked the safe and found a key.}{if doorCode: You solved the bookshelf puzzle and activated the door keypad.}{if door: you unlocked the door.} What do you want to do?</p>\n<p>{if door: Go into the <a class=\"squiffy-link link-passage\" data-passage=\"hallway\" role=\"link\" tabindex=\"0\">hallway</a>}{else:Go to the <a class=\"squiffy-link link-passage\" data-passage=\"door\" role=\"link\" tabindex=\"0\">door</a>}{if safe:}{else:, examine the <a class=\"squiffy-link link-passage\" data-passage=\"safe\" role=\"link\" tabindex=\"0\">safe</a>}{if doorCode: }{else:, check out the <a class=\"squiffy-link link-passage\" data-passage=\"bookshelf\" role=\"link\" tabindex=\"0\">bookshelf</a>}{if window: or go onto the <a class=\"squiffy-link link-passage\" data-passage=\"balcony\" role=\"link\" tabindex=\"0\">balcony</a>}{else: or go to the <a class=\"squiffy-link link-passage\" data-passage=\"window\" role=\"link\" tabindex=\"0\">window</a>}?</p>",
			},
			'door': {
				'clear': true,
				'text': "<p>{if doorCode: The door&#39;s keypad appears to be lit up.  The buttons make a noise.  You wonder what key code to enter.</p>\n<p>Do you want to enter a <a class=\"squiffy-link link-passage\" data-passage=\"code\" role=\"link\" tabindex=\"0\">code</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?}{else: The door has a keypad next to it, but no lights are on.  It appears it is not working. Did you want to try to hit some <a class=\"squiffy-link link-passage\" data-passage=\"buttons\" role=\"link\" tabindex=\"0\">buttons</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?}</p>",
			},
			'buttons': {
				'clear': true,
				'text': "<p>Yeah these buttons don&#39;t do anything, but it sure was fun.  You go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a> to see what else you can do.</p>",
			},
			'window': {
				'clear': true,
				'text': "<p>The window has a padlock keeping it closed.  You must have to answer the questions stapled to the windows frame. Did you want to  try the <a class=\"squiffy-link link-passage\" data-passage=\"padlock\" role=\"link\" tabindex=\"0\">padlock</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?</p>",
			},
			'balcony': {
				'clear': true,
				'text': "<p>You step out the window onto this small balcony.  There is a fence around the gate to keep people from falling to their death{if not lock:, but there is a lock on a section of the gate.{if safe: Did you want to try the key you found in this <a class=\"squiffy-link link-passage\" data-passage=\"lock\" role=\"link\" tabindex=\"0\">lock</a>?}{else: Unfortunately, you don&#39;t have the key needed to open this lock.  Maybe its back in the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a> somewhere.}}{else:.  Did you want to go up to the <a class=\"squiffy-link link-section\" data-section=\"roof1\" role=\"link\" tabindex=\"0\">roof</a> or back into the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?}</p>",
			},
			'lock': {
				'clear': true,
				'text': "<p>{@lock}\nIt looks like the key you picked up from the safe fits perfectly into the lock and turns with a loud snap and the gate swings open. On the other side of the gate is a ladder leading up to the roof.  There is no way to get down from here.  Did you want to take the ladder to the <a class=\"squiffy-link link-section\" data-section=\"roof1\" role=\"link\" tabindex=\"0\">roof</a> or head back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?</p>",
			},
			'hallway': {
				'clear': true,
				'text': "<p>You step out into the hallway quietly.  As you move forward you see you are on the second floor because in front of you is a railing overlooking the 1st floor. You hear voices coming from right under you. To your right is a set of stairs going up and down. You are too scared to go down the stairs. Did you want to climb the stairs to the <a class=\"squiffy-link link-section\" data-section=\"roof1\" role=\"link\" tabindex=\"0\">roof</a> or go back into the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?</p>",
			},
			'code': {
				'clear': true,
				'text': "<p>To find the correct code for the door you answer the questions surrounding the keypad.  Answer question 4--&gt;3--&gt;7--&gt;2 in that order.</p>\n<p>What is the keypad code?<input type=\"text\" id=\"doorInput\" pattern=\"A-Za-z\" maxlength=\"4\" autocomplete=\"off\">   <a class=\"squiffy-link link-passage\" data-passage=\"doorCode\" role=\"link\" tabindex=\"0\">check</a></p>",
			},
			'padlock': {
				'clear': true,
				'text': "<p>To find the correct combo for the padlock on the window answer question 8--&gt;1--&gt;9--&gt;6 in that order.</p>\n<p>What is the padlock code?</p>\n<p><input type=\"text\" id=\"windowInput\" pattern=\"A-Za-z\" maxlength=\"4\" autocomplete=\"off\"> <a class=\"squiffy-link link-passage\" data-passage=\"windowCode\" role=\"link\" tabindex=\"0\">check</a></p>",
			},
			'bookshelf': {
				'clear': true,
				'text': "<p>You see a bookshelf with many books on it.  Each book has a different letter and they are very disorganized.  You feel like this bookshelf is some code that if you pull out the right books something will happen, but which books should you pull out?</p>\n<p>Did you want to pull out some <a class=\"squiffy-link link-passage\" data-passage=\"books\" role=\"link\" tabindex=\"0\">books</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?</p>",
			},
			'books': {
				'clear': true,
				'text': "<p>Answer questions 11--&gt;10--&gt;15--&gt;14 in order to get the correct books to pull out from the bookshelf.</p>\n<p><input type=\"text\" id=\"bookshelfInput\" pattern=\"A-Za-z\" maxlength=\"4\" autocomplete=\"off\"> <a class=\"squiffy-link link-passage\" data-passage=\"bookshelfCode\" role=\"link\" tabindex=\"0\">done</a></p>",
			},
			'safe': {
				'clear': true,
				'text': "<p>The safe is fairly small and the dial on the front has letters, not numbers.  Did you want to try to open the safe by trying the <a class=\"squiffy-link link-passage\" data-passage=\"combination\" role=\"link\" tabindex=\"0\">combination</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?</p>",
			},
			'combination': {
				'clear': true,
				'text': "<p>Answer questions 16--&gt;13--&gt;12--&gt;14 in order to get the combination to open the safe.</p>\n<p><input type=\"text\" id=\"comboInput\" pattern=\"A-Za-z\" maxlength=\"4\" autocomplete=\"off\"> <a class=\"squiffy-link link-passage\" data-passage=\"comboCode\" role=\"link\" tabindex=\"0\">done</a></p>",
			},
			'windowCode': {
				'text': "<p>{if ansW=8342:You got it right! The window opens. Did you want to climb out onto the <a class=\"squiffy-link link-passage\" data-passage=\"balcony\" role=\"link\" tabindex=\"0\">balcony</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?{@window}}\n{else:That is not correct.  <a class=\"squiffy-link link-passage\" data-passage=\"padlock\" role=\"link\" tabindex=\"0\">Try again</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?}</p>",
				'js': function() {
					{squiffy.set("ansW", jQuery("#windowInput").val().toLowerCase());}
					    
				},
			},
			'bookshelfCode': {
				'text': "<p>{if ansB=pink: The bookshelf slides away from the wall and you see what looks like a light switch hidden here.  Did you want to hit the <a class=\"squiffy-link link-passage\" data-passage=\"switch\" role=\"link\" tabindex=\"0\">switch</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?} \n{else:That doesn&#39;t seem to be right. Want to <a class=\"squiffy-link link-passage\" data-passage=\"books\" role=\"link\" tabindex=\"0\">try again?</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?}</p>",
				'js': function() {
					{squiffy.set("ansB", jQuery("#bookshelfInput").val().toLowerCase());}
				},
			},
			'switch': {
				'clear': true,
				'text': "<p>When you hit the switch the codepad by the door beeps. It must be working now.{@doorCode}  Did you want to head over to the <a class=\"squiffy-link link-passage\" data-passage=\"door\" role=\"link\" tabindex=\"0\">door</a> or back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?</p>",
			},
			'comboCode': {
				'text': "<p>{if ansC=tesk:{@safe}You hear a click and the door creaks open. Inside you see a key.{if window: This must be for the balcony gate lock. Did you want to go back onto the <a class=\"squiffy-link link-passage\" data-passage=\"balcony\" role=\"link\" tabindex=\"0\">balcony</a> or back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?}{else: You wonder what this key is for so you take it. You decide to go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>.}}\n{else:That doesn&#39;t seem to be right. Want to <a class=\"squiffy-link link-passage\" data-passage=\"combination\" role=\"link\" tabindex=\"0\">try again?</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?}</p>",
				'js': function() {
					{squiffy.set("ansC", jQuery("#comboInput").val().toLowerCase());}
				},
			},
			'doorCode': {
				'text': "<p>{if ansD=9185:{@door} When you hit the last digit you hear the lock on the door make a click. You try the handle of the door and it opens into a hallway. Do you want to step into the <a class=\"squiffy-link link-passage\" data-passage=\"hallway\" role=\"link\" tabindex=\"0\">hallway</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?}\n{else:That doesn&#39;t seem to be right. Want to <a class=\"squiffy-link link-passage\" data-passage=\"code\" role=\"link\" tabindex=\"0\">try again?</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"mainRoom\" role=\"link\" tabindex=\"0\">room</a>?}</p>",
				'js': function() {
					{squiffy.set("ansD", jQuery("#doorInput").val().toLowerCase());}
				},
			},
		},
	},
	'roof1': {
		'clear': true,
		'text': "<p>After a short climb you make it to the roof.  The roof is flat and black and hot. You see a fire escape on the far side of the roof.  There are also more math problems taped on various objects. </p>\n<p>Did you want to inspect the <a class=\"squiffy-link link-passage\" data-passage=\"fire\" role=\"link\" tabindex=\"0\">fire escape</a>, the <a class=\"squiffy-link link-passage\" data-passage=\"chimney\" role=\"link\" tabindex=\"0\">chimney</a>, or the <a class=\"squiffy-link link-passage\" data-passage=\"box\" role=\"link\" tabindex=\"0\">electrical box</a>?</p>",
		'passages': {
			'roof': {
				'clear': true,
				'text': "<p>The roof is flat and black and hot. You see a fire escape on the far side of the roof.  There are also more math problems taped on various objects. </p>\n<p>Did you want to {if fireOpen:go onto the <a class=\"squiffy-link link-passage\" data-passage=\"lift\" role=\"link\" tabindex=\"0\">lift</a>}{else:inspect the <a class=\"squiffy-link link-passage\" data-passage=\"fire\" role=\"link\" tabindex=\"0\">fire escape</a>}{if key:}{else:, go to the <a class=\"squiffy-link link-passage\" data-passage=\"chimney\" role=\"link\" tabindex=\"0\">chimney</a>,}{if box:}{else: or the <a class=\"squiffy-link link-passage\" data-passage=\"box\" role=\"link\" tabindex=\"0\">electrical box</a>}?</p>",
			},
			'fire': {
				'clear': true,
				'text': "<p>{if fire:}{else:Some fool put a gate and lock over the fire escape.}{if key:{@fireOpen} You have a key, lets see if it works in this lock. Thankfully it fits perfectly and unlocks the gate. On the other side of the gate looks like a motorized lift that could take you down to the ground to safety.{if box: The motor is running on the lift.} Do you want to step onto the <a class=\"squiffy-link link-passage\" data-passage=\"lift\" role=\"link\" tabindex=\"0\">lift</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"roof\" role=\"link\" tabindex=\"0\">roof</a>?}{else: This lock needs a key.  The other side of the gate looks like a motorized lift that could take you down to the ground and safety.{if box: The motor is running on the lift if only you could get over to it.} You go back to the <a class=\"squiffy-link link-passage\" data-passage=\"roof\" role=\"link\" tabindex=\"0\">roof</a>.}\n{@fire}</p>",
			},
			'chimney': {
				'clear': true,
				'text': "<p>This chimney is too small for you to climb inside, but as you reach your arm inside you feel a rope.  You pull the rope up and attached is a notebook with various math problems. Also attached to the rope further down is a key inside a very study container with a lock on it....another lock.  Maybe the solutions to the math problems will help you get into the container.</p>\n<p>Did you want to try to open the <a class=\"squiffy-link link-passage\" data-passage=\"container\" role=\"link\" tabindex=\"0\">container</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"roof\" role=\"link\" tabindex=\"0\">roof</a>?</p>",
			},
			'box': {
				'clear': true,
				'text': "<p>There are various wires that have been pulled loose and are sparking. The top of the electrical box has a set of wires running toward the fire escape. Maybe if you can hook the wires up the right way something good will happen.</p>\n<p>Did you want to try to hook the <a class=\"squiffy-link link-passage\" data-passage=\"wires\" role=\"link\" tabindex=\"0\">wires</a> up or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"roof\" role=\"link\" tabindex=\"0\">roof</a>?</p>",
			},
			'container': {
				'clear': true,
				'text': "<p>Answer questions 2--&gt;7--&gt;5--&gt;8 in order to get the combination to open the container from the chimney.</p>\n<p><input type=\"text\" id=\"jarInput\" pattern=\"A-Za-z\" maxlength=\"4\" autocomplete=\"off\">\n<a class=\"squiffy-link link-passage\" data-passage=\"jarCode\" role=\"link\" tabindex=\"0\">done</a></p>",
			},
			'wires': {
				'clear': true,
				'text': "<p>Answer questions 12--&gt;11--&gt;17--&gt;16 in order to find the right locations to plut these wires into in the electrical box.</p>\n<p><input type=\"text\" id=\"boxInput\" pattern=\"A-Za-z\" maxlength=\"4\" autocomplete=\"off\">\n<a class=\"squiffy-link link-passage\" data-passage=\"boxCode\" role=\"link\" tabindex=\"0\">done</a></p>",
			},
			'jarCode': {
				'text': "<p>{if ansJ=5878:{@key} You got the right combo to open the container.  You fetch the key and keep it safe. {if fire:Do you want to go back to the <a class=\"squiffy-link link-passage\" data-passage=\"fire\" role=\"link\" tabindex=\"0\">fire escape</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"roof\" role=\"link\" tabindex=\"0\">roof</a>?}{else: You decide to go back to the <a class=\"squiffy-link link-passage\" data-passage=\"roof\" role=\"link\" tabindex=\"0\">roof</a>.}}\n{else:That doesn&#39;t seem to be right. Want to <a class=\"squiffy-link link-passage\" data-passage=\"container\" role=\"link\" tabindex=\"0\">try again</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"roof\" role=\"link\" tabindex=\"0\">roof</a>?}</p>",
				'js': function() {
					{squiffy.set("ansJ", jQuery("#jarInput").val());}
				},
			},
			'boxCode': {
				'text': "<p>{if ansE=sprt:{@box} This combination of wires made the motorized lift on the other side of the fire escape start to run. {if fireOpen: Do you want to go onto the <a class=\"squiffy-link link-passage\" data-passage=\"lift\" role=\"link\" tabindex=\"0\">lift</a>}{else:Do you want to go to the <a class=\"squiffy-link link-passage\" data-passage=\"fire\" role=\"link\" tabindex=\"0\">fire escape</a>} or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"roof\" role=\"link\" tabindex=\"0\">roof</a>?}\n{else:That doesn&#39;t seem to be right. Want to <a class=\"squiffy-link link-passage\" data-passage=\"wires\" role=\"link\" tabindex=\"0\">try again</a> or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"roof\" role=\"link\" tabindex=\"0\">roof</a>?}</p>",
				'js': function() {
					{squiffy.set("ansE", jQuery("#boxInput").val().toLowerCase());}
				},
			},
			'lift': {
				'text': "<p>{if box: You step on the lift and hit the down button.  The lift lurches down suddenly. You fall much too fast and just before you hit the ground <a class=\"squiffy-link link-passage\" data-passage=\"...\" role=\"link\" tabindex=\"0\">...</a> }{else: You step onto the lift, but when you hit the button nothing happens.  Maybe you have to power it on somehow.  You decide to head back over to the <a class=\"squiffy-link link-passage\" data-passage=\"roof\" role=\"link\" tabindex=\"0\">roof</a>.}</p>",
			},
			'...': {
				'clear': true,
				'text': "<p>...you wake up realizing that this whole thing was all just a bad dream. You look at the puddle of drool you left on your math book, and realize you completed all your homework while in the dream.</p>\n<p>Thank goodness that&#39;s all done!</p>",
			},
		},
	},
}
})();