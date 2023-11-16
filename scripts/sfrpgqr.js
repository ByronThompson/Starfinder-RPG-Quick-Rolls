Hooks.on("preCreateChatMessage", (message) => {
    if(game.user.isGM || game.settings.get("sfrpgqr", "PlayersCanQuickRoll")){
        if(message.flavor.includes("Attack Roll") && message.user._id === game.user._id) compareAttackRoll(message)
    }
})

Hooks.on("renderChatMessage", (message, html) => {
    setTimeout(() => {
        if(message.flags.sfrpgqr?.results){
            html = html.find(".message-header")
            html.append($(`${message.flags.sfrpgqr.results}`))
            ui.chat.scrollBottom();
        }

        if(message.flavor.includes("Damage Roll")){
            let h = html.find(".message-content")
            let damage = message.flags.damage?.amount
            let section = $(`
            <section class="damage-application">

            </section>`)

            let damageButton = $(`
            <button type="button" title="[Click] Apply full damage to selected tokens.
            [Shift-Click] Adjust value before applying.">
                <i class="fa-solid fa-heart-broken fa-fw"></i>
                <span class="label">Damage</span>
            </button>`)
            damageButton.on("click", () => {applyDamageToToken(html, 1)})
            section.append(damageButton)

            let halfButton = $(`
            <button type="button" class="half-damage" data-action="half-damage" title="[Click] Apply half damage to selected tokens.
            [Shift-Click] Adjust value before applying.">
                <i class="fa-solid fa-heart-broken fa-fw"></i>
                <span class="label">Half</span>
            </button>`)
            halfButton.on("click", () => {applyDamageToToken(html, 0.5)})
            section.append(halfButton)

            let doubleButton = $(`
            <button type="button" data-action="double-damage" title="[Click] Apply double damage to selected tokens.
            [Shift-Click] Adjust value before applying.">
                <i class="fa-solid fa-skull-crossbones fa-fw"></i>
                <span class="label">Double</span>
            </button>`)
            doubleButton.on("click", () => {applyDamageToToken(html, 2)})
            section.append(doubleButton)

            let healButton = $(`
            <button type="button" class="apply-healing" data-action="apply-healing" title="[Click] Apply full healing to selected tokens.
                [Shift-Click] Adjust value before applying.">
                    <span class="fa-stack fa-fw">
                        <i class="fa-solid fa-heart fa-stack-2x"></i>
                        <i class="fa-solid fa-plus fa-inverse fa-stack-1x"></i>
                    </span>
                    <span class="label">Heal</span>
            </button>`)
            healButton.on("click", () => {applyDamageToToken(html, -1)})
            section.append(healButton)

            h.append(section)

            //let foot = $(h.find(".sfrpg.dice-roll").find(".dice-footer"))
            //h.find(".sfrpg.dice-roll").find(".dice-footer").remove()

            //h.append(foot)
        }
    }, 0)
})

Math.clamp = function (number, min, max) {
    return Math.max(min, Math.min(number, max));
}

function applyDamageToToken(html, mult){
    game.sfrpg.Actor.Type.applyDamageFromContextMenu(html, mult)
}

function compareAttackRoll(message){
    if(message.type != 5) return;

    let compiledMessage = ``;

    let result = message.rolls[0]._total;
    let defense = message.flags.rollOptions.actionTarget;

    game.user.targets.forEach(token => {
        let targetDefense = token.document.actor.system.attributes[defense].value

        let success = result >= targetDefense ? 1 : 0
        let isNat20 = message.rolls[0].terms[0].results[0].result === 20
        let isNat1 = message.rolls[0].terms[0].results[0].result === 1

        if(isNat1) success -= 1
        if(isNat20) success += 1

        success = Math.clamp(success, 0, 2)

        let hitBy = result - targetDefense

        compiledMessage += generateChatMessage(token, success, hitBy, true);
    })

    if (game.user.targets.size > 0) {
        const chatData = {
            user: game.user._id,
            content: compiledMessage
        }
        //showResults(chatData);
        message.updateSource({
            "flags.sfrpgqr.results" : compiledMessage
        })
    }
}

const StatusTextsByStep = {
	0: { "hitType": "m", "symbol": "❌", "color": "#131516"  },
	1: { "hitType": "h", "symbol": "✔️", "color": "#131516" },
	2: { "hitType": "ch", "symbol": "💥", "color": "#4C7D4C"  }
};

const SaveMessagesByStep = {
    0: { "message": "Failed", "chatMessage": "❌ Fail" },
    1: { "message": "Succeeded", "chatMessage": "✔️ Success" },
    2: { "message": "Critically succeeded", "chatMessage": "💥 Crit Success" }
}

const AttackMessagesByStep = {
    0: { "message": "Missed", "chatMessage": "❌ Miss" },
    1: { "message": "Hit", "chatMessage": "✔️ Hit" },
    2: { "message": "Critically hit", "chatMessage": "💥 Crit Hit" }
}


function generateChatMessage(token, successStep, successBy, isAttack) {
    const status = StatusTextsByStep[successStep];
    const messagesByStep = isAttack ? AttackMessagesByStep : SaveMessagesByStep;
    const message = messagesByStep[successStep];

	//if (game.settings.get("pf2qr", "ShowBubbles")) canvas.hud.bubbles.say(token, message.chatMessage, { emote: true });
	
	return `
			<div class="targetPicker" style="flex:0 0 100%" data-target="${token.id}" data-hitType="${status.hitType}">
				<div style="color:#131516;margin-top:2px;margin-bottom:2px">
					${status.symbol} <b>${token.name}: ${message.message}${(game.settings.get("sfrpgqr", "ShowExceedsBy") ? ` by ${successBy}` : ``)}${successStep == 0 || successStep == 3 ? '!' : '.'}</b>
				</div>
			</div>`;

            /*
            <div style="border-bottom: 2px solid black;color:#131516;padding-bottom:4px;">
					${status.symbol}
				<b style="color:${status.color}">
					${message.message}${(game.settings.get("sfrpgqr", "ShowExceedsBy") ? ` by ${successBy}` : ``)}${successStep == 0 || successStep == 3 ? '!' : '.'}
				</b>
				</div>
            */
}

function showResults(chatData) {
    //Use this to determine if it should be shown to players or not.
    if (!game.settings.get("sfrpgqr", "ShowPlayersResults")) {
        chatData.user = game.users.entities.find(u => u.isGM)._id; //Imitating GM so that we don't see our own message to the GM, in the case it is a player rolling.
        chatData.speaker = ChatMessage.getSpeaker({ user: game.user });
    } 

// Socket decisions. If user is not a Gm and showresults is true, send data to GM.

// If GM and showResults is true, process chatmessage as normal and whisper to GM

// Else if setting is still false, create chatdata publicly
    if (!game.user.isGM && !game.settings.get("sfrpgqr", "ShowPlayersResults"))
    {
        console.log("EMITTING USER DATA TO GM")
        game.socket.emit('module.sfrpgqr', chatData);

    } else if (game.user.isGM && !game.settings.get("sfrpgqr", "ShowPlayersResults")) {

        chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
        
        console.log("PROCESSING USER DATA AS GM!")
        ChatMessage.create(chatData);
        
    } else if (game.settings.get("sfrpgqr", "ShowPlayersResults"))
    {
        ChatMessage.create(chatData);
    }
}

function hoverTarget() {
    $("#chat-log").on('mouseover', '.targetPicker', function () {
        $(this).css("background-color", "yellow");
        canvas.tokens.placeables.find(t => t.id === $(this).attr("data-target"))._onHoverIn({})
    });

    $("#chat-log").on('dblclick', '.targetPicker', function (e) {
        let base = this;
        
        $(this).parent().children(".targetPicker").each(function () {
            if ($(base).attr("data-hitType") === $(this).attr("data-hitType")) {
                $(this).finish().fadeOut(40).fadeIn(40);
                (canvas.tokens.placeables.find(t => t.id === $(this).attr("data-target"))).control({ releaseOthers: false });
            }
        });
    })

    $("#chat-log").on('click', '.targetPicker', function (e) {
        $(this).finish().fadeOut(40).fadeIn(40);
        const target = getTarget($(this).attr("data-target"));
        
        if (target._controlled) {
            if (e.shiftKey || canvas.tokens.controlled.length === 1) { 
                target.release();
            } else {
                target.control({ releaseOthers: true });
            }
        } else {
            target.control({ releaseOthers: !e.shiftKey });
        }
    });

    $("#chat-log").on('mouseout', '.targetPicker', function () {
        $(this).css("background-color", "transparent");
        canvas.tokens.placeables.find(t => t.id === $(this).attr("data-target"))._onHoverOut({})
    });
}

function getTarget(dataId) {
    return canvas.tokens.placeables.find(t => t.id === dataId);
}

Hooks.on("renderChatLog", () => {
    hoverTarget();
})

Hooks.on('ready', () => {
    console.log("Registering...")
    game.socket.on('module.sfrpgqr', async (data) => {
        if (game.user.isGM && data) showResults(data);
      });
    })


Hooks.on('ready', () => {
    [
        {
            name: "ShowPlayersResults",
            hint: "Whether players should see the results of rolls. Private/Blind rolls will serve a similar function soon(TM).",
            scope: "world",
            default: true,
            type: Boolean
        },

        {
            name: "ShowExceedsBy",
            hint: "Whether to show how much a roll exceeded the AC/DC for.",
            scope: "world",
            default: true,
            type: Boolean
        },

        {
            name: "PlayersCanQuickRoll",
            hint: "If disabled, only the GM can quick roll.",
            scope: "world",
            default: true,
            type: Boolean
        }
    ].forEach((setting) => {
        let options = {
            name: setting.name,
            hint: setting.hint,
            scope: setting.scope,
            config: true,
            default: setting.default,
            type: setting.type,
        };
        game.settings.register("sfrpgqr", setting.name, options);
    })
    console.log("Starfinder Quick Rolls | Ready")
})