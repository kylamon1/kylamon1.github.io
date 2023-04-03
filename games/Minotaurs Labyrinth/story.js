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
squiffy.story.id = 'b6f631cca4';
squiffy.story.sections = {
	'_default': {
		'clear': true,
		'text': "<h1 id=\"you-wake-up-in-a-small-dark-room-\">You wake up in a small dark room.</h1>\n<p>Your memory is a bit fuzzy but you remember that you were on a quest to get the treasure from the legendary Minotaur hidden deep within his labyrinth.  You discovered the entrance was a cave.  As you started to work out how to go farther a low rumbling sound and the sound of loud snorting sent you into a panic.  You ran.  You ran so fast you slipped and cracked your head on the floor. And now <a class=\"squiffy-link link-passage\" data-passage=\"cell\" role=\"link\" tabindex=\"0\">here you are</a>.</p>",
		'attributes': ["ropesRight = 0","ropesWrong = 0","mazeRight = 0","mazeWrong = 0","fightRight = 0","fightWrong = 0","chestRight = 0","chestWrong = 0","hasMap = 0","R1=up","R2=up","R3=down","R4=down","R5=down","R6=up","squares=0"],
		'js': function() {
			 
			
		},
		'passages': {
			'restart': {
				'clear': true,
				'text': "<h1 id=\"your-room\">Your Room</h1>\n<p>You wake up in a small dark room.  You feel like you have been here before, though nothing seems out of the ordinary.  You get a shock of a memory of being impaled by the spikes from the ceiling and shudder. And now <a class=\"squiffy-link link-passage\" data-passage=\"cell\" role=\"link\" tabindex=\"0\">here you are</a>.</p>",
				'attributes': ["ropesRight = 0","hasMap = 0","R1=up","R2=up","R3=down","R4=down","R5=down","R6=up"],
			},
			'cell': {
				'clear': true,
				'text': "<h1 id=\"your-room\">Your Room</h1>\n<p>The room you are in is small, like a prison cell with a tall ceiling. It is cold, damp, and dark.  There is a bit of light coming from a candle in your room{if torch2:, but the hallway is dark.}{else: and there is some light you can see through your cell door from a {if torch:torch}{else:<a class=\"squiffy-link link-passage\" data-passage=\"torch\" role=\"link\" tabindex=\"0\">torch</a>} outside.} {if ropesRight: Your cell door is open because you found the correct combination using the ropes.}{else:Your <a class=\"squiffy-link link-passage\" data-passage=\"cell door\" role=\"link\" tabindex=\"0\">cell door</a> is made of sturdy steel bars.  {if seen cell door:There are <a class=\"squiffy-link link-passage\" data-passage=\"ropes\" role=\"link\" tabindex=\"0\">6 ropes</a> hanging from the ceiling on the wall near the door.}} {if hasMap:}{else:Next to your bed there is a <a class=\"squiffy-link link-passage\" data-passage=\"box\" role=\"link\" tabindex=\"0\">box</a>.}</p>\n<p>{if deadRope&gt;0: You faintly remember picking up a <a class=\"squiffy-link link-passage\" data-passage=\"paper\" role=\"link\" tabindex=\"0\">paper</a> from the box in the room from that weird dream you have.  The paper was a map or clue of some sort to get through the maze.}{else:\n{if hasMap:You are carrying a <a class=\"squiffy-link link-passage\" data-passage=\"paper\" role=\"link\" tabindex=\"0\">paper</a> that has a clue to get out of here.}}</p>\n<p>{if maze1: Did you want to go out into the <a class=\"squiffy-link link-passage\" data-passage=\"maze\" role=\"link\" tabindex=\"0\">maze</a>?}</p>",
			},
			'torch': {
				'text': "<p>{@torch}The torch is on the wall across the way from your door.  There is no way you could reach it from here, but maybe if you got out.</p>",
			},
			'cell door': {
				'clear': true,
				'text': "<h1 id=\"cell-door\">Cell Door</h1>\n<p>{if R1=up:{if R2=down:{if R3=up:{if R4=up:{if R5=down:{if R6=up: {@ropesRight=1}}}}}}}\n{if ropesRight:{@maze1}You push the door and it <b>opens!</b> This must have been the correct positioning for those ropes. Did you want to continue out the door into the <a class=\"squiffy-link link-passage\" data-passage=\"maze\" role=\"link\" tabindex=\"0\">maze</a> or go back into your <a class=\"squiffy-link link-passage\" data-passage=\"cell\" role=\"link\" tabindex=\"0\">room</a>?}{else:\n{if ropes: {@ropesWrong+=1} You tug and pull the door, but it doesn&#39;t budge.  Maybe you don&#39;t have those ropes set in the right position. {if ropesWrong=1:You hear a <u>thunk</u> sound from above you. It is now you notice that the ceiling is a large metal plate with a bunch of equally spaced holes. These holes have 3 foot-steel spikes sticking out of them.  Maybe getting the ropes in the wrong position made the spikes lower. Do you want to go back to the <a class=\"squiffy-link link-passage\" data-passage=\"ropes\" role=\"link\" tabindex=\"0\">ropes</a> or go back to the center of your <a class=\"squiffy-link link-passage\" data-passage=\"cell\" role=\"link\" tabindex=\"0\">room</a>?}{if ropesWrong=3:  Suddenly the spikes lurch down the whole way to the ground, piercing your body in the process.  You cry out in pain, <a class=\"squiffy-link link-passage\" data-passage=\"restart\" role=\"link\" tabindex=\"0\">then...</a>}{if ropesWrong=2: The spikes on the ceiling just dropped over 3-feet.  You don&#39;t want to know if you get the ropes wrong again.  Do you want to go back to the <a class=\"squiffy-link link-passage\" data-passage=\"ropes\" role=\"link\" tabindex=\"0\">ropes</a> or go back to the center of your <a class=\"squiffy-link link-passage\" data-passage=\"cell\" role=\"link\" tabindex=\"0\">room</a>?} }\n{else:This door is very strong.  You push {sequence:and pull...:and tug...:and push more but it only wiggles a bit.  As you do this you notice there are <b>6 ropes</b> hanging from the ceiling on the wall near the door. </p>\n<p>Do you go back to check on those <a class=\"squiffy-link link-passage\" data-passage=\"ropes\" role=\"link\" tabindex=\"0\">ropes</a> or go the center of your <a class=\"squiffy-link link-passage\" data-passage=\"cell\" role=\"link\" tabindex=\"0\">room</a> to look around more.}}}</p>",
			},
			'box': {
				'text': "<p>The box is made of sturdy wood.  Too big to carry, and too strong to break.  On this small box there is a <a class=\"squiffy-link link-passage\" data-passage=\"metal plate\" role=\"link\" tabindex=\"0\">metal plate</a> and on the plate is a candle.</p>",
			},
			'metal plate': {
				'text': "<p>You pick up the plate and underneath someone has left a piece of yellowed paper.  Using the candle you look at the <a class=\"squiffy-link link-passage\" data-passage=\"paper\" role=\"link\" tabindex=\"0\">paper</a>.</p>",
			},
			'paper': {
				'text': "<p>{@hasMap = 1}\nThe paper reads:</p>\n<p>If the maze you want to solve,</p>\n<p>These questions you will need.</p>\n<p>Solve them in this order,</p>\n<p>Go now with great speed.</p>\n<p>Then underneath you see the following scribbled:</p>\n<p>Q9, Q12, Q8, Q7, Q10, Q11</p>\n<p>You put this paper in your pocket as it sounds important.  Do you want to go back to the center of the <a class=\"squiffy-link link-passage\" data-passage=\"cell\" role=\"link\" tabindex=\"0\">room</a> to look for a way out{if ropesRight:}{else:{if ropes:, go check on those <a class=\"squiffy-link link-passage\" data-passage=\"ropes\" role=\"link\" tabindex=\"0\">ropes</a>}}{if maze1: or go back into the <a class=\"squiffy-link link-passage\" data-passage=\"maze\" role=\"link\" tabindex=\"0\">maze</a>}?</p>",
			},
			'ropes': {
				'clear': true,
				'text': "<p>{@ropes}</p>\n<h1 id=\"ropes\">Ropes</h1>\n<p>There is a series of ropes.  You inspect the ropes and notice that on each rope is a piece of tape with something written on it. They seem like labels.  The first rope has &quot;Q1&quot; on its label, the second rope is labeled &quot;Q4&quot;, the third rope is labeled &quot;Q5&quot;, The forth rope is labeled &quot;Q2&quot;, The fifth rope is labeled &quot;Q3&quot;, and the sixth rope is labeled &quot;Q6&quot;.  These ropes look like you should pull them up or down in some sort of pattern.</p>\n<p>Right now the rope sequence looks like:</p>\n<p>The first rope is <b>{R1}</b></p>\n<p>The second rope is <b>{R2}</b></p>\n<p>The third rope is <b>{R3}</b></p>\n<p>The fourth rope is <b>{R4}</b></p>\n<p>The fifth rope is <b>{R5}</b></p>\n<p>The sixth rope is <b>{R6}</b></p>\n<p>Do you want to <a class=\"squiffy-link link-passage\" data-passage=\"ropeChange\" role=\"link\" tabindex=\"0\">modify the ropes</a>, check the <a class=\"squiffy-link link-passage\" data-passage=\"cell door\" role=\"link\" tabindex=\"0\">cell door</a>, or go back to the middle of the <a class=\"squiffy-link link-passage\" data-passage=\"cell\" role=\"link\" tabindex=\"0\">room</a>?</p>",
			},
			'ropeChange': {
				'text': "<p>{@ropesRight=0}</p>\n<p>You make the first rope in the <b>{if R1=down:{rotate R1:down:up}}{else:{rotate R1:up:down}}</b> position.</p>\n<p>You make the second rope in the <b>{if R2=down:{rotate R2:down:up}}{else:{rotate R2:up:down}}</b> position.</p>\n<p>You make the third rope in the <b>{if R3=down:{rotate R3:down:up}}{else:{rotate R3:up:down}}</b> position.</p>\n<p>You make the fourth rope in the <b>{if R4=down:{rotate R4:down:up}}{else:{rotate R4:up:down}}</b> position.</p>\n<p>You make the fifth rope in the <b>{if R5=down:{rotate R5:down:up}}{else:{rotate R5:up:down}}</b> position.</p>\n<p>You make the sixth rope in the <b>{if R6=down:{rotate R6:down:up}}{else:{rotate R6:up:down}}</b> position.</p>\n<p>Do you want to check on the <a class=\"squiffy-link link-passage\" data-passage=\"cell door\" role=\"link\" tabindex=\"0\">cell door</a> to see if you got the correct pattern, go back to inspect the <a class=\"squiffy-link link-passage\" data-passage=\"ropes\" role=\"link\" tabindex=\"0\">ropes</a> again, or go back to the center of your <a class=\"squiffy-link link-passage\" data-passage=\"cell\" role=\"link\" tabindex=\"0\">room</a>?</p>",
			},
			'maze': {
				'clear': true,
				'text': "<h1 id=\"outside-your-cell\">Outside your Cell</h1>\n<p>{@maze1}\n{if plan:{if hasMap: <b>You wonder about looking at that <a class=\"squiffy-link link-passage\" data-passage=\"paper\" role=\"link\" tabindex=\"0\">paper</a> again.</b> }{else: <b>You wonder if there is a map to this maze somewhere.</b> }}{else:You are right outside of your room.  You need to find your way through this maze.  }{if torch2: There is no light anywhere.  You may even fall in a pit and die.  You may be able to feel your way through this thing, but you are sure to get turned around unless you have a definite plan.}{else:In every direction you look you just see a few torches scattered on rough stone walls including one <a class=\"squiffy-link link-passage\" data-passage=\"torch2\" role=\"link\" tabindex=\"0\">torch</a> right across this walkway from your room.  There are gaps and passages in every direction you look Including ladders leading up and down to different levels.  You definitely should get a game plan before you try to go through this maze.}</p>\n<p>{if hasMap:You are carrying a <a class=\"squiffy-link link-passage\" data-passage=\"paper\" role=\"link\" tabindex=\"0\">paper</a> that has a clue to get out of here.}\nDo you want to venture out into the <a class=\"squiffy-link link-passage\" data-passage=\"maze2\" role=\"link\" tabindex=\"0\">maze</a> or head back into your <a class=\"squiffy-link link-passage\" data-passage=\"cell\" role=\"link\" tabindex=\"0\">room</a>?</p>",
			},
			'torch2': {
				'text': "<p>{@torch2}\nYou walk over to the torch and right as you reach to grab it you hear a loud <u><i>HARUMPH</i></u> sound and a blast of wind sweeps down the hallway extinguishing all the torches.  The only light you have now is the small candle in your room sitting on the metal plate by the box.</p>",
			},
			'maze2': {
				'text': "<p>What is your game plan for this maze?</p>\n<p>At the first intersection you are going to go <b>{rotate M1:left:right:straight:up:down}</b>.</p>\n<p>At the second intersection you are going to go <b>{rotate M2:left:right:straight:up:down}</b>.</p>\n<p>At the third intersection you are going to go <b>{rotate M3:left:right:straight:up:down}</b>.</p>\n<p>At the fourth intersection you are going to go <b>{rotate M4:left:right:straight:up:down}</b>.</p>\n<p>At the fifth intersection you are going to go <b>{rotate M5:left:right:straight:up:down}</b>.</p>\n<p>At the sixth intersection you are going to go <b>{rotate M6:left:right:straight:up:down}</b>.</p>\n<p>Are you ready to carry out your <a class=\"squiffy-link link-passage\" data-passage=\"plan\" role=\"link\" tabindex=\"0\">plan</a> or do you want to go back into your <a class=\"squiffy-link link-passage\" data-passage=\"cell\" role=\"link\" tabindex=\"0\">room</a>?</p>",
			},
			'plan': {
				'clear': true,
				'text': "<p>{@plan}\n{if M1=straight:{if M2=right:{if M3=left:{if M4=down:{if M5=straight:{if M6=up:{@mazeRight=1}}}}}}}{if mazeRight=1: You go <b>straight</b> through the first intersection. You cant see anything but you keep your hands on the walls.  At the next intersection you went <b>right</b>. As you round the corner your foot grazes a large hole, but you keep your balance and continue on. You take the next <b>left</b> and then head <b>down</b> a ramp.  The air is starting to have more of a musty smell.  You head <b>straight</b> through the next intersection.  Ahead of you you can see a ladder with an orange glow coming from the space above.  You climb the ladder into a room lit by many candles.  The air smells of incense and musk. Your plan through the labyrinth worked.  You made it to the <a class=\"squiffy-link link-passage\" data-passage=\"lair\" role=\"link\" tabindex=\"0\">Minotaur&#39;s lair</a>.}{else: {@mazeWrong+=1} You head out and go <b>{M1}</b> at the first intersection. All around you can hear wind gust.  Some directions smell better than others.  At the next intersection you head <b>{M2}</b>. You make the next <b>{M3}</b>, <b>{M4}</b> and <b>{M5}</b> quickly. Finally you head <b>{M6}</b> at the next intersection.  You look around and you seem to be right outside your own cell with everything right the way you left it.  Your plan must have been flawed and you got turned around. Lets take another attempt at this <a class=\"squiffy-link link-passage\" data-passage=\"maze\" role=\"link\" tabindex=\"0\">maze</a>.}</p>",
			},
			'lair': {
				'clear': true,
				'text': "<h1 id=\"minotaur-s-lair\">Minotaur&#39;s Lair</h1>\n<p>You look around and see a large oak chest with metal seams holding it together.  As you walk toward the chest you hear the familiar snorting sound from coming from right behind you.  </p>\n<p>You turn around you see a huge 8 foot Minotaur stalking toward you.  The beast has large bull hooves, a hairy human-like chest with massive arms, and the head of a bull including horns. The Minotaur takes one massive fist and throws a punch straight for your face.  Your adrenaline kicks in and time seems to slow.  The Minotaur&#39;s hand is moving in slow motion toward your face. As you ready yourself to <a class=\"squiffy-link link-passage\" data-passage=\"fight1\" role=\"link\" tabindex=\"0\">fight</a> your heightened senses see <a class=\"squiffy-link link-passage\" data-passage=\"tattoo\" role=\"link\" tabindex=\"0\">something weird tattooed</a> on the Minotaur&#39;s knuckles.</p>",
			},
			'fight1': {
				'clear': true,
				'text': "<p>{@fight}\nYour years fighting in the gladiator&#39;s arena is paying off.  You will use your skills in fighting to plan out this battle so there is no way you can lose. {if tatoo:Do you want to remember what was <a class=\"squiffy-link link-passage\" data-passage=\"tattoo\" role=\"link\" tabindex=\"0\">tattooed</a> across his fingers?}{else: The sight of that weird <a class=\"squiffy-link link-passage\" data-passage=\"tattoo\" role=\"link\" tabindex=\"0\">tattoo</a> on its knuckles is more than a little distracting.}</p>\n<p>First you will <b>{rotate F1:block:dodge:duck:strike}</b>....<a class=\"squiffy-link link-passage\" data-passage=\"fight2\" role=\"link\" tabindex=\"0\">Are you sure?</a></p>",
			},
			'tattoo': {
				'text': "<p>{@tatoo}\nOn his knuckles you see tattooed across his fingers &quot;Q13&quot; on the first finger, &quot;Q14” on the second finger, &quot;Q16&quot; on the third finger, and &quot;Q15&quot; on his fourth finger. This may be some clue to beating the Minotaur.{if fight: You shake your head to refocus yourself and get ready to <a class=\"squiffy-link link-passage\" data-passage=\"fight1\" role=\"link\" tabindex=\"0\">fight</a>.}</p>",
			},
			'fight2': {
				'clear': true,
				'text': "<p>{if F1=duck:First you will <b>duck</b> to avoid the fist coming at your head.}\n{if F1=strike:First you will <b>strike</b> the Minotaur in the eye with your fist.}\n{if F1=block:First you will <b>block</b> the Minotaur&#39;s next punch with your arms.}\n{if F1=dodge:First you will <b>dodge</b> when the Minotaur charges at you.}</p>\n<p>Next you will <b>{rotate F2:block:dodge:duck:strike}</b>.... <a class=\"squiffy-link link-passage\" data-passage=\"fight3\" role=\"link\" tabindex=\"0\">Are you sure</a></p>\n<p>Or did you want to rethink the fight from the <a class=\"squiffy-link link-passage\" data-passage=\"fight1\" role=\"link\" tabindex=\"0\">beginning?</a></p>",
			},
			'fight3': {
				'clear': true,
				'text': "<p>{if F1=duck:First you will <b>duck</b> to avoid the fist coming at your head.}\n{if F1=strike:First you will <b>strike</b> the Minotaur in the eye with your fist.}\n{if F1=block:First you will <b>block</b> the Minotaur&#39;s next punch with your arms.}\n{if F1=dodge:First you will <b>dodge</b> when the Minotaur charges at you.}</p>\n<p>{if F2=duck:Next you will <b>duck</b> to avoid the fist coming at your head.}\n{if F2=strike:Next you will <b>strike</b> the Minotaur in the eye with your fist.}\n{if F2=block:Next you will <b>block</b> the Minotaur&#39;s next punch with your arms.}\n{if F2=dodge:Next you will <b>dodge</b> when the Minotaur charges at you.}</p>\n<p>Next you will <b>{rotate F3:block:dodge:duck:strike}</b>.... <a class=\"squiffy-link link-passage\" data-passage=\"fight4\" role=\"link\" tabindex=\"0\">Are you sure</a></p>\n<p>Or did you want to rethink the fight from the <a class=\"squiffy-link link-passage\" data-passage=\"fight1\" role=\"link\" tabindex=\"0\">beginning?</a></p>",
			},
			'fight4': {
				'clear': true,
				'text': "<p>{if F1=duck:First you will <b>duck</b> to avoid the fist coming at your head.}\n{if F1=strike:First you will <b>strike</b> the Minotaur in the eye with your fist.}\n{if F1=block:First you will <b>block</b> the Minotaur&#39;s next punch with your arms.}\n{if F1=dodge:First you will <b>dodge</b> when the Minotaur charges at you.}</p>\n<p>{if F2=duck:Next you will <b>duck</b> to avoid the fist coming at your head.}\n{if F2=strike:Next you will <b>strike</b> the Minotaur in the eye with your fist.}\n{if F2=block:Next you will <b>block</b> the Minotaur&#39;s next punch with your arms.}\n{if F2=dodge:Next you will <b>dodge</b> when the Minotaur charges at you.}</p>\n<p>{if F3=duck:Then you will <b>duck</b> to avoid the fist coming at your head.}\n{if F3=strike:Then you will <b>strike</b> the Minotaur in the eye with your fist.}\n{if F3=block:Then you will <b>block</b> the Minotaur&#39;s next punch with your arms.}\n{if F3=dodge:Then you will <b>dodge</b> when the Minotaur charges at you.}</p>\n<p>Next you will <b>{rotate F4:block:dodge:duck:strike}</b>.... <a class=\"squiffy-link link-passage\" data-passage=\"fight5\" role=\"link\" tabindex=\"0\">Are you sure</a></p>\n<p>Or did you want to rethink the fight from the <a class=\"squiffy-link link-passage\" data-passage=\"fight1\" role=\"link\" tabindex=\"0\">beginning?</a></p>",
			},
			'fight5': {
				'clear': true,
				'text': "<p>{if F1=duck:First you will <b>duck</b> to avoid the fist coming at your head.}\n{if F1=strike:First you will <b>strike</b> the Minotaur in the eye with your fist.}\n{if F1=block:First you will <b>block</b> the Minotaur&#39;s next punch with your arms.}\n{if F1=dodge:First you will <b>dodge</b> when the Minotaur charges at you.}</p>\n<p>{if F2=duck:Next you will <b>duck</b> to avoid the fist coming at your head.}\n{if F2=strike:Next you will <b>strike</b> the Minotaur in the eye with your fist.}\n{if F2=block:Next you will <b>block</b> the Minotaur&#39;s next punch with your arms.}\n{if F2=dodge:next you will <b>dodge</b> when the Minotaur charges at you.}</p>\n<p>{if F3=duck:Then you will <b>duck</b> to avoid the fist coming at your head.}\n{if F3=strike:Then you will <b>strike</b> the Minotaur in the eye with your fist.}\n{if F3=block:Then you will <b>block</b> the Minotaur&#39;s next punch with your arms.}\n{if F3=dodge:Then you will <b>dodge</b> when the Minotaur charges at you.}</p>\n<p>{if F4=duck:Finally you will <b>duck</b> to avoid the fist coming at your head.}\n{if F4=strike:Finally you will <b>strike</b> the Minotaur in the eye with your fist.}\n{if F4=block:Finally you will <b>block</b> the Minotaur&#39;s next punch with your arms.}\n{if F4=dodge:Finally you will <b>dodge</b> when the Minotaur charges at you.}</p>\n<p>So this is your plan. Are you ready to <a class=\"squiffy-link link-passage\" data-passage=\"fight6\" role=\"link\" tabindex=\"0\">fight the Minotaur</a> or did you want to rethink the fight from the <a class=\"squiffy-link link-passage\" data-passage=\"fight1\" role=\"link\" tabindex=\"0\">beginning?</a></p>",
			},
			'fight6': {
				'clear': true,
				'text': "<h1 id=\"the-fight\">The Fight</h1>\n<p>{if F1=duck:{if F2=strike:{if F3=block:{if F4=dodge: {@fightRight=1}}}}}\n{if fightRight=1:You <b>duck</b> under the Minotaur&#39;s first strike aimed at your face and follow up with a quick <b>strike</b> hitting it on its left eye.  The Minotaur roars with rage and hurls a nearby candle at you, but you <b>block</b> this candle with your arms. Finally the Minotaur charges at you and you <b>dodge</b> at the last second and it crashes head first into a wall knocking itself out cold.  That was a heck of a plan.\nYou decide now is the time to open that <a class=\"squiffy-link link-passage\" data-passage=\"chest\" role=\"link\" tabindex=\"0\">chest</a>.}\n{else:{@fightWrong+=1} As the Minotaur&#39;s fist comes at your face you <b>{if F1=strike: attempt to strike back}{else:{F1}}</b>. Then you followed up with a quick <b>{F2}</b>. The Minotaur seems to be getting the upper hand.  When you try your next <b>{F3}</b> it grabs your arm and pulls you in close.  You try one final <b>{F4}</b>, but it is in vain. He pounds his fist on the top of your skull and you black out.  You awake at the base of the ladder leading up to the Minotaur&#39;s lair.  He must have thought he killed you and tossed you down here like his trash. Your plan must not have been thought out enough so you weren&#39;t able to predict the Minotaur&#39;s moves accurately.  You ready yourself and climb back up the ladder into the Minotaur&#39;s <a class=\"squiffy-link link-passage\" data-passage=\"lair\" role=\"link\" tabindex=\"0\">lair</a>.}</p>",
			},
			'chest': {
				'clear': true,
				'text': "<h1 id=\"the-chest\">The Chest</h1>\n<p>This chest is much too big to carry out of here, you are going to have to open it to see what treasure lies inside. On top of the chest there are <a class=\"squiffy-link link-passage\" data-passage=\"chestLock\" role=\"link\" tabindex=\"0\">4 square slots</a>.  {if squares&gt;0:{if squares&lt;4:You have some squares, but not enough to fill 4 slots. You decide to <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> some more to see what else you can find.}{else:You have enough squares, but need to decide which squares go into which slot. </p>\n<p>Do you want to try to <a class=\"squiffy-link link-passage\" data-passage=\"chestLock\" role=\"link\" tabindex=\"0\">open the chest</a> or <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> the room for more clues to opening the chest?}}{else:There must be something you put into these slots that open the chest.  You decide to <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> to see what could work.}</p>",
			},
			'look around': {
				'clear': true,
				'text': "<h1 id=\"the-minotaur-s-lair-again\">The Minotaur&#39;s Lair...again</h1>\n<p>You glance around and see {if paintings:paintings hung on the wall, {if minotaur:}{else:the resting <a class=\"squiffy-link link-passage\" data-passage=\"Minotaur\" role=\"link\" tabindex=\"0\">Minotaur</a> on the floor,}}{else:<a class=\"squiffy-link link-passage\" data-passage=\"paintings\" role=\"link\" tabindex=\"0\">paintings</a> hung on the wall,} piles of {if plates:plates}{else:<a class=\"squiffy-link link-passage\" data-passage=\"plates\" role=\"link\" tabindex=\"0\">plates</a>} in one corner, and a large cushion probably used for a {if bed:bed}{else:<a class=\"squiffy-link link-passage\" data-passage=\"bed\" role=\"link\" tabindex=\"0\">bed</a>}. There is also the <a class=\"squiffy-link link-passage\" data-passage=\"chest\" role=\"link\" tabindex=\"0\">chest</a> you are trying to open. What do you want to check out?</p>\n<p>{if squares&gt;0: You currently have {squares} square tiles.}</p>",
			},
			'paintings': {
				'clear': true,
				'text': "<h1 id=\"paintings\">Paintings</h1>\n<p>{@paintings}\nThese paintings are old.  The paint is chipping off most of them and the rest of it is hard to make out because of the very dim light cast by the candles in this room. You hear the Minotaur grunt and see its leg twitch, reminding you you should hurry before he awakes. Maybe the Minotaur has something on him that might be useful.</p>\n<p>Did you want to inspect the <a class=\"squiffy-link link-passage\" data-passage=\"Minotaur\" role=\"link\" tabindex=\"0\">Minotaur</a>, <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> the room some more or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"chest\" role=\"link\" tabindex=\"0\">chest</a>?</p>",
			},
			'Minotaur': {
				'clear': true,
				'text': "<h1 id=\"the-minotaur\">The Minotaur</h1>\n<p>{@minotaur}\n{@squares+=4}\nYou rummage through the belongings of the Minotaur and in a leather purse tied to his belt there are <b>4 square tiles</b> that appear to be just the right size for the top of that chest. These tiles have the numbers <b> 1, 3, 6, and 8</b> on them.</p>\n<p>Did you want to try to open that <a class=\"squiffy-link link-passage\" data-passage=\"chest\" role=\"link\" tabindex=\"0\">chest</a> or go back and <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> the room some more?</p>",
			},
			'plates': {
				'clear': true,
				'text': "<h1 id=\"pile-of-plates\">Pile of Plates</h1>\n<p>{@plates}\nThe plates are piled high.  Many contain food stuffs and large amounts of mold.  That could be part of the rank smell from this room.</p>\n<p>Did you want to <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> the room some more or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"chest\" role=\"link\" tabindex=\"0\">chest</a>?</p>",
			},
			'bed': {
				'clear': true,
				'text': "<h1 id=\"the-big-bed\">The Big Bed</h1>\n<p>{@bed}\n{@squares += 2}\nThe bed is large enough for an 8-foot Minotaur, and smells like it has never been washed. You poke it with your foot, but you don&#39;t notice anything.  You lift one corner to see what is underneath and you find <b>two square tiles</b> with the numbers 4 and 2 on them.  </p>\n<p>Did you want to <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> the room some more or go back to the <a class=\"squiffy-link link-passage\" data-passage=\"chest\" role=\"link\" tabindex=\"0\">chest</a>?</p>",
			},
			'chestLock': {
				'clear': true,
				'text': "<h1 id=\"opening-the-chest\">Opening the Chest</h1>\n<p>The square slots on the top of the chest are in a line.  Etched into the wood in each of the square slots is more letters and numbers.  In the first slot you see &quot;Q18&quot;, in the second slot is etched &quot;Q20&quot;, in the third slot is carved &quot;Q17&quot;, and in the last slot is carved &quot;Q19&quot;.</p>\n<p>{if squares=0:You don&#39;t have anything to put into these square slots.  You decide to <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> the room to see what you might find.}\n{if squares=2: You have 2 square tiles that could fit into those slots, but you need at least 4. You decide to <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> the room to see what you might find.}\n{if squares=4: You have 4 square tiles that could fit into those slots.  You have the tiles with the <b>numbers 1, 3, 6, and 8</b>.  How would you like to place them?</p>\n<p>In the first slot you put in the <b>{rotate T1:number 1:number 3:number 6:number 8}</b> tile.</p>\n<p>In the second slot you put in the <b>{rotate T2:number 1:number 3:number 6:number 8}</b> tile.</p>\n<p>In the third slot you put in the <b>{rotate T3:number 1:number 3:number 6:number 8}</b> tile.</p>\n<p>In the fourth slot you put in the <b>{rotate T4:number 1:number 3:number 6:number 8}</b> tile.</p>\n<p>You get the feeling there may be more tiles than this. Did you want to <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> a bit more or check to see if the chest will  <a class=\"squiffy-link link-passage\" data-passage=\"chestOpen\" role=\"link\" tabindex=\"0\">open</a>...}\n{if squares=6: You have 6 square tiles that could fit into those slots.  You have the tiles with the <b>numbers 1, 2, 3, 4, 6, and 8</b>.  How would you like to place them?</p>\n<p>In the first slot you put in the <b>{rotate T1:number 1:number 2:number 3:number 4:number 6:number 8}</b> tile.</p>\n<p>In the second slot you put in the <b>{rotate T2:number 1:number 2:number 3:number 4:number 6:number 8}</b> tile.</p>\n<p>In the third slot you put in the <b>{rotate T3:number 1:number 2:number 3:number 4:number 6:number 8}</b> tile.</p>\n<p>In the fourth slot you put in the <b>{rotate T4:number 1:number 2:number 3:number 4:number 6:number 8}</b> tile.</p>\n<p>After placing the tiles you give the lid a <a class=\"squiffy-link link-passage\" data-passage=\"chestOpen\" role=\"link\" tabindex=\"0\">tug</a>...}</p>",
			},
			'chestOpen': {
				'text': "<p>{if T1=number 4:{if T2=number 6:{if T3=number 2:{if T4=number 8:\n...and it <b>OPENS!!</b> Your hard work is really paying off.  You inspect the treasures inside and a single tear of happiness rolls down your cheek. You cram as much of these gold and jewel encrusted items in a sack and head back down the ladder.  Later on you write a <a class=\"squiffy-link link-passage\" data-passage=\"journal\" role=\"link\" tabindex=\"0\">journal</a> of your time in the Minotaur&#39;s labyrinth.}\n{else:{@chestWrong+=1}It does not open.  You must not have all the tiles in the correct places.\nDo you want to go back and inspect the <a class=\"squiffy-link link-passage\" data-passage=\"chestLock\" role=\"link\" tabindex=\"0\">tiles</a> on the chest lid or <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> the room for more clues?}}\n{else:{@chestWrong+=1}It does not open.  You must not have all the tiles in the correct places.\nDo you want to go back and inspect the <a class=\"squiffy-link link-passage\" data-passage=\"chestLock\" role=\"link\" tabindex=\"0\">tiles</a> on the chest lid or <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> the room for more clues?}}\n{else:{@chestWrong+=1}It does not open.  You must not have all the tiles in the correct places.\nDo you want to go back and inspect the <a class=\"squiffy-link link-passage\" data-passage=\"chestLock\" role=\"link\" tabindex=\"0\">tiles</a> on the chest lid or <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> the room for more clues?}}\n{else:{@chestWrong+=1}It does not open.  You must not have all the tiles in the correct places.\nDo you want to go back and inspect the <a class=\"squiffy-link link-passage\" data-passage=\"chestLock\" role=\"link\" tabindex=\"0\">tiles</a> on the chest lid or <a class=\"squiffy-link link-passage\" data-passage=\"look around\" role=\"link\" tabindex=\"0\">look around</a> the room for more clues?}</p>",
			},
			'journal': {
				'clear': true,
				'text': "<h1 id=\"your-journal\">Your Journal</h1>\n<h2 id=\"show-this-to-your-teacher-as-proof-of-besting-the-beast-and-stealing-his-treasure-you-may-even-get-another-prize-\">Show this to your teacher as proof of besting the beast and stealing his treasure. You may even get another prize!</h2>\n<p>You were able to escape your cell after <b>{@ropesWrong+=1}{ropesWrong} attempt(s)</b> at the ropes.</p>\n<p>You found your way through the maze after <b>{@mazeWrong+=1}{mazeWrong} attempt(s).</b></p>\n<p>You bested the beast after <b>{@fightWrong+=1}{fightWrong} attempt(s).</b></p>\n<p>You were able to open the chest of treasure after <b>{@chestWrong+=1}{chestWrong} attempt(s).</b></p>\n<h1 id=\"great-job-adventurer-\">Great Job Adventurer!</h1>",
			},
		},
	},
}
})();